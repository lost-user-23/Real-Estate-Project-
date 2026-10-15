import test from "node:test";
import assert from "node:assert/strict";
import {
  LOAN_PRESETS,
  clamp,
  computeLoan,
  computeLoanForType,
  parseLoanQuery,
  sanitizeLoanInputs,
  yearlySchedule,
} from "./loanMath.mjs";

const params = (obj) => new URLSearchParams(obj);

test("standard home loan: 50L at 8.5% for 20 years", () => {
  const r = computeLoan({ principal: 5_000_000, annualRate: 8.5, tenureMonths: 240 });
  assert.equal(r.emi, 43391); // well-known figure for these inputs
  assert.equal(r.months, 240);
  assert.equal(r.totalInterest, r.totalPayment - 5_000_000);
  assert.ok(Math.abs(r.totalPayment - 43391 * 240) < 240); // within rounding of emi * months
});

test("standard personal loan: 5L at 13.5% for 3 years", () => {
  const r = computeLoan({ principal: 500_000, annualRate: 13.5, tenureMonths: 36 });
  assert.equal(r.emi, 16968); // closed form: P*r*(1+r)^n/((1+r)^n-1), r=0.01125, n=36
  assert.ok(r.totalInterest > 100_000 && r.totalInterest < 120_000);
});

test("zero interest splits the principal evenly", () => {
  const r = computeLoan({ principal: 120_000, annualRate: 0, tenureMonths: 12 });
  assert.equal(r.emi, 10000);
  assert.equal(r.totalInterest, 0);
  assert.equal(r.totalPayment, 120_000);
});

test("zero interest with an uneven split still closes at zero", () => {
  const r = computeLoan({ principal: 100_000, annualRate: 0, tenureMonths: 7 });
  assert.equal(r.totalPayment, 100_000);
  assert.equal(r.schedule.at(-1).closing, 0);
});

test("one month tenure repays principal plus one month of interest", () => {
  const r = computeLoan({ principal: 100_000, annualRate: 12, tenureMonths: 1 });
  assert.equal(r.emi, 101_000);
  assert.equal(r.totalInterest, 1000);
  assert.equal(r.schedule.length, 1);
  assert.equal(r.schedule[0].closing, 0);
});

test("invalid, missing and non-finite inputs give an all-zero result, never NaN", () => {
  const bad = [
    {},
    { principal: 0, annualRate: 8, tenureMonths: 12 },
    { principal: -5, annualRate: 8, tenureMonths: 12 },
    { principal: NaN, annualRate: 8, tenureMonths: 12 },
    { principal: Infinity, annualRate: 8, tenureMonths: 12 },
    { principal: 1000, annualRate: -1, tenureMonths: 12 },
    { principal: 1000, annualRate: NaN, tenureMonths: 12 },
    { principal: 1000, annualRate: 8, tenureMonths: 0 },
    { principal: 1000, annualRate: 8, tenureMonths: NaN },
    { principal: "abc", annualRate: 8, tenureMonths: 12 },
    { principal: undefined, annualRate: undefined, tenureMonths: undefined },
  ];
  for (const input of bad) {
    const r = computeLoan(input);
    assert.deepEqual(
      [r.emi, r.totalPayment, r.totalInterest, r.months, r.schedule.length],
      [0, 0, 0, 0, 0],
      JSON.stringify(input)
    );
  }
});

test("clamp falls back on non-numeric input and respects both bounds", () => {
  assert.equal(clamp("x", 1, 10, 5), 5);
  assert.equal(clamp(NaN, 1, 10, 5), 5);
  assert.equal(clamp(null, 1, 10, 5), 5);
  assert.equal(clamp(-3, 1, 10, 5), 1);
  assert.equal(clamp(99, 1, 10, 5), 10);
  assert.equal(clamp("7", 1, 10, 5), 7);
  assert.equal(clamp("1e9", 1, 10, 5), 5);
});

test("sanitize clamps to each loan type's lower and upper bounds", () => {
  const home = LOAN_PRESETS.home;
  const personal = LOAN_PRESETS.personal;
  assert.deepEqual(sanitizeLoanInputs("home", { amount: 1, rate: 0, tenureYears: 0 }), {
    amount: home.amount.min,
    rate: home.rate.min,
    tenureYears: home.tenure.min,
  });
  assert.deepEqual(sanitizeLoanInputs("home", { amount: 1e12, rate: 99, tenureYears: 99 }), {
    amount: home.amount.max,
    rate: home.rate.max,
    tenureYears: home.tenure.max,
  });
  assert.deepEqual(sanitizeLoanInputs("personal", { amount: 1e12, rate: 99, tenureYears: 99 }), {
    amount: personal.amount.max,
    rate: personal.rate.max,
    tenureYears: personal.tenure.max,
  });
  assert.deepEqual(sanitizeLoanInputs("personal", {}), {
    amount: 500_000,
    rate: 13.5,
    tenureYears: 3,
  });
  // an unknown type is treated as a home loan
  assert.equal(sanitizeLoanInputs("gold", {}).amount, home.amount.default);
});

test("presets match the documented ranges and defaults", () => {
  assert.deepEqual(
    [LOAN_PRESETS.personal.amount.default, LOAN_PRESETS.personal.rate.default, LOAN_PRESETS.personal.tenure.default],
    [500_000, 13.5, 3]
  );
  assert.deepEqual(
    [LOAN_PRESETS.home.amount.default, LOAN_PRESETS.home.rate.default, LOAN_PRESETS.home.tenure.default],
    [5_000_000, 8.5, 20]
  );
  assert.deepEqual([LOAN_PRESETS.personal.amount.min, LOAN_PRESETS.personal.amount.max], [50_000, 4_000_000]);
  assert.deepEqual([LOAN_PRESETS.home.amount.min, LOAN_PRESETS.home.amount.max], [100_000, 50_000_000]);
});

test("amortization: principal repaid sums to the loan, interest to total interest, final balance is 0", () => {
  for (const [principal, rate, months] of [
    [5_000_000, 8.5, 240],
    [500_000, 13.5, 36],
    [123_457, 9.75, 17],
    [100_000, 0, 7],
  ]) {
    const r = computeLoan({ principal, annualRate: rate, tenureMonths: months });
    const principalSum = r.schedule.reduce((s, row) => s + row.principalPaid, 0);
    const interestSum = r.schedule.reduce((s, row) => s + row.interest, 0);
    assert.equal(principalSum, principal);
    assert.equal(interestSum, r.totalInterest);
    assert.equal(principalSum + interestSum, r.totalPayment);
    assert.equal(r.schedule.at(-1).closing, 0);
    // each row chains to the next
    r.schedule.forEach((row, i) => {
      assert.equal(row.opening - row.principalPaid, row.closing);
      if (i > 0) assert.equal(row.opening, r.schedule[i - 1].closing);
    });
  }
});

test("yearly schedule groups 12 months and keeps the same totals", () => {
  const r = computeLoan({ principal: 500_000, annualRate: 13.5, tenureMonths: 40 });
  const years = yearlySchedule(r.schedule);
  assert.equal(years.length, 4); // 12 + 12 + 12 + 4
  assert.equal(years[0].opening, 500_000);
  assert.equal(years.at(-1).closing, 0);
  assert.equal(years.reduce((s, y) => s + y.principalPaid, 0), 500_000);
  assert.equal(years.reduce((s, y) => s + y.interest, 0), r.totalInterest);
  assert.deepEqual(yearlySchedule([]), []);
});

test("computeLoanForType clamps out-of-range and garbage input before calculating", () => {
  const r = computeLoanForType("personal", { amount: "nope", rate: -4, tenureYears: 500 });
  assert.deepEqual(r.inputs, { amount: 500_000, rate: 9, tenureYears: 7 });
  assert.ok(r.emi > 0);
  assert.equal(r.schedule.length, 84);
});

test("URL prefill: valid values are used and clamped", () => {
  assert.deepEqual(parseLoanQuery(params({ amount: "7500000", type: "home" })), { type: "home", amount: 7_500_000 });
  assert.deepEqual(parseLoanQuery(params({ type: "personal", amount: "900000000", rate: "50", tenure: "2" })), {
    type: "personal",
    amount: 4_000_000,
    rate: 30,
    tenureYears: 2,
  });
});

test("URL prefill: invalid or hostile values are ignored without throwing", () => {
  assert.deepEqual(parseLoanQuery(params({})), { type: "home" });
  assert.deepEqual(parseLoanQuery(params({ type: "<script>", amount: "abc", rate: "NaN", tenure: "Infinity" })), {
    type: "home",
  });
  assert.deepEqual(parseLoanQuery(params({ amount: "-100", tenure: "1e3", rate: "0x10" })), { type: "home" });
  assert.deepEqual(parseLoanQuery(null), { type: "home" });
  assert.deepEqual(parseLoanQuery(undefined), { type: "home" });
  assert.deepEqual(parseLoanQuery({ get() { throw new Error("boom"); } }), { type: "home" });
});
