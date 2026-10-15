// Pure loan maths for the EMI calculator. No React, no browser APIs, so it can
// be unit-tested with `node --test`.
//
// Rounding rule: money is whole rupees. The EMI is rounded once; interest is
// rounded each month; the final instalment absorbs the leftover so the balance
// closes at exactly 0. Totals are the sums of the schedule, so the EMI, total
// interest, total repayment and amortization table always agree.

export const LOAN_TYPES = ["home", "personal"];

export const LOAN_PRESETS = {
  home: {
    label: "Home loan",
    amount: { min: 100_000, max: 50_000_000, step: 100_000, default: 5_000_000 },
    rate: { min: 4, max: 18, step: 0.05, default: 8.5 },
    tenure: { min: 1, max: 30, step: 1, default: 20 },
  },
  personal: {
    label: "Personal loan",
    amount: { min: 50_000, max: 4_000_000, step: 10_000, default: 500_000 },
    rate: { min: 9, max: 30, step: 0.05, default: 13.5 },
    tenure: { min: 1, max: 7, step: 1, default: 3 },
  },
};

export function isLoanType(value) {
  return LOAN_TYPES.includes(value);
}

// Number from a number or a plain numeric string; anything else is NaN.
function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\s*\d+(\.\d+)?\s*$/.test(value)) return Number(value);
  return Number.NaN;
}

export function clamp(value, min, max, fallback) {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// Always returns in-range numbers for the loan type; bad input falls back to the preset default.
export function sanitizeLoanInputs(type, raw = {}) {
  const preset = LOAN_PRESETS[isLoanType(type) ? type : "home"];
  return {
    amount: Math.round(clamp(raw.amount, preset.amount.min, preset.amount.max, preset.amount.default)),
    rate: Math.round(clamp(raw.rate, preset.rate.min, preset.rate.max, preset.rate.default) * 100) / 100,
    tenureYears: Math.round(clamp(raw.tenureYears, preset.tenure.min, preset.tenure.max, preset.tenure.default)),
  };
}

const EMPTY = Object.freeze({ emi: 0, totalPayment: 0, totalInterest: 0, months: 0, schedule: [] });

// Low-level calculation. Returns the all-zero result for invalid input
// (non-finite, principal <= 0, rate < 0, tenure < 1 month) instead of NaN.
export function computeLoan({ principal, annualRate, tenureMonths }) {
  const p = Math.round(Number(principal));
  const rate = Number(annualRate);
  const months = Math.round(Number(tenureMonths));
  if (!Number.isFinite(p) || p <= 0) return { ...EMPTY, schedule: [] };
  if (!Number.isFinite(rate) || rate < 0) return { ...EMPTY, schedule: [] };
  if (!Number.isFinite(months) || months < 1) return { ...EMPTY, schedule: [] };

  const monthlyRate = rate / 12 / 100;
  let rawEmi;
  if (monthlyRate === 0) {
    rawEmi = p / months;
  } else {
    const factor = Math.pow(1 + monthlyRate, months);
    rawEmi = (p * monthlyRate * factor) / (factor - 1);
  }
  if (!Number.isFinite(rawEmi)) return { ...EMPTY, schedule: [] };
  const emi = Math.round(rawEmi);

  const schedule = [];
  let balance = p;
  let totalPayment = 0;
  for (let month = 1; month <= months; month += 1) {
    const interest = Math.round(balance * monthlyRate);
    const isLast = month === months;
    const principalPaid = isLast ? balance : Math.min(balance, Math.max(0, emi - interest));
    const payment = principalPaid + interest;
    const opening = balance;
    balance -= principalPaid;
    totalPayment += payment;
    schedule.push({ month, opening, principalPaid, interest, closing: balance });
  }

  return { emi, totalPayment, totalInterest: totalPayment - p, months, schedule };
}

// Type-aware entry point used by the UI: clamps first, then calculates.
export function computeLoanForType(type, raw) {
  const inputs = sanitizeLoanInputs(type, raw);
  return {
    inputs,
    ...computeLoan({
      principal: inputs.amount,
      annualRate: inputs.rate,
      tenureMonths: inputs.tenureYears * 12,
    }),
  };
}

// Groups the monthly schedule into loan years (12 months each).
export function yearlySchedule(monthly) {
  const years = [];
  for (let i = 0; i < monthly.length; i += 12) {
    const chunk = monthly.slice(i, i + 12);
    years.push({
      year: i / 12 + 1,
      opening: chunk[0].opening,
      principalPaid: chunk.reduce((sum, row) => sum + row.principalPaid, 0),
      interest: chunk.reduce((sum, row) => sum + row.interest, 0),
      closing: chunk[chunk.length - 1].closing,
    });
  }
  return years;
}

// Reads a URLSearchParams-like object (anything with .get) into safe,
// already-clamped initial values. Unknown or malformed values are ignored.
export function parseLoanQuery(params) {
  const get = (key) => {
    try {
      const value = params?.get?.(key);
      return typeof value === "string" ? value : null;
    } catch {
      return null;
    }
  };
  const typeParam = get("type");
  const type = isLoanType(typeParam) ? typeParam : "home";
  const preset = LOAN_PRESETS[type];
  const out = { type };
  const amount = get("amount");
  const rate = get("rate");
  const tenure = get("tenure");
  if (amount !== null && Number.isFinite(toNumber(amount))) {
    out.amount = Math.round(clamp(amount, preset.amount.min, preset.amount.max, preset.amount.default));
  }
  if (rate !== null && Number.isFinite(toNumber(rate))) {
    out.rate = Math.round(clamp(rate, preset.rate.min, preset.rate.max, preset.rate.default) * 100) / 100;
  }
  if (tenure !== null && Number.isFinite(toNumber(tenure))) {
    out.tenureYears = Math.round(clamp(tenure, preset.tenure.min, preset.tenure.max, preset.tenure.default));
  }
  return out;
}
