"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatPrice } from "@/lib/format";
import {
  LOAN_PRESETS,
  LOAN_TYPES,
  clamp,
  computeLoanForType,
  parseLoanQuery,
  yearlySchedule,
} from "@/lib/loanMath.mjs";

const fieldLabel = "mb-1.5 block text-xs font-medium text-text-muted";
const fieldInput =
  "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary";

const rupees = (value) => `₹${Math.round(value).toLocaleString("en-IN")}`;

function initialState(searchParams) {
  const query = parseLoanQuery(searchParams);
  const preset = LOAN_PRESETS[query.type];
  return {
    type: query.type,
    amount: String(query.amount ?? preset.amount.default),
    rate: String(query.rate ?? preset.rate.default),
    tenure: String(query.tenureYears ?? preset.tenure.default),
  };
}

export function EmiCalculator() {
  const searchParams = useSearchParams();
  const [state, setState] = useState(() => initialState(searchParams));
  const [scheduleMode, setScheduleMode] = useState("off"); // "off" | "yearly" | "monthly"
  const { type, amount, rate, tenure } = state;
  const preset = LOAN_PRESETS[type];

  // Values are always clamped before they reach the maths, whatever is typed.
  const result = useMemo(
    () => computeLoanForType(type, { amount, rate, tenureYears: tenure }),
    [type, amount, rate, tenure]
  );
  const { inputs, emi, totalPayment, totalInterest } = result;

  const rows = useMemo(() => {
    if (scheduleMode === "yearly") {
      return yearlySchedule(result.schedule).map((r) => ({ key: r.year, label: `Year ${r.year}`, ...r }));
    }
    if (scheduleMode === "monthly") {
      return result.schedule.map((r) => ({ key: r.month, label: `Month ${r.month}`, ...r }));
    }
    return [];
  }, [result.schedule, scheduleMode]);

  const setField = (field) => (event) => setState((prev) => ({ ...prev, [field]: event.target.value }));
  // On blur / slider commit, replace whatever was typed with the clamped value.
  const commitField = (field, value) => setState((prev) => ({ ...prev, [field]: String(value) }));

  const switchType = (next) => {
    if (next === type) return;
    const p = LOAN_PRESETS[next];
    setState({
      type: next,
      amount: String(p.amount.default),
      rate: String(p.rate.default),
      tenure: String(p.tenure.default),
    });
  };

  // Out-of-range or non-numeric text is flagged, and the calculation uses the clamped value.
  const problem = (raw, bounds, fmt) => {
    const n = clamp(raw, -Infinity, Infinity, Number.NaN);
    if (Number.isFinite(n) && n >= bounds.min && n <= bounds.max) return "";
    return `Enter a value between ${fmt(bounds.min)} and ${fmt(bounds.max)}. Using ${fmt(
      bounds === preset.amount ? inputs.amount : bounds === preset.rate ? inputs.rate : inputs.tenureYears
    )}.`;
  };
  const amountError = problem(amount, preset.amount, rupees);
  const rateError = problem(rate, preset.rate, (v) => `${v}%`);
  const tenureError = problem(tenure, preset.tenure, (v) => `${v} yr`);

  const principalShare = totalPayment > 0 ? (inputs.amount / totalPayment) * 100 : 100;
  const loansParams = new URLSearchParams({ type, amount: String(inputs.amount) });
  const propertyId = searchParams.get("propertyId");
  if (propertyId && /^[a-f\d]{24}$/i.test(propertyId)) loansParams.set("propertyId", propertyId);

  return (
    <div className="flex flex-col gap-8">
      <div role="radiogroup" aria-label="Loan type" className="inline-flex self-start rounded-full border border-border bg-surface p-1">
        {LOAN_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => switchType(t)}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              type === t ? "bg-primary text-white" : "text-text hover:bg-bg"
            }`}
          >
            {LOAN_PRESETS[t].label}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()} aria-label={`${preset.label} EMI inputs`}>
          <div>
            <label className={fieldLabel} htmlFor="emi-principal">
              Loan amount ({formatPrice(inputs.amount)})
            </label>
            <input
              id="emi-principal"
              type="range"
              min={preset.amount.min}
              max={preset.amount.max}
              step={preset.amount.step}
              value={inputs.amount}
              onChange={(e) => commitField("amount", clamp(e.target.value, preset.amount.min, preset.amount.max, preset.amount.default))}
              className="w-full accent-primary"
            />
            <input
              type="number"
              inputMode="numeric"
              min={preset.amount.min}
              max={preset.amount.max}
              step={preset.amount.step}
              value={amount}
              onChange={setField("amount")}
              onBlur={() => commitField("amount", inputs.amount)}
              aria-invalid={Boolean(amountError)}
              aria-describedby={amountError ? "emi-amount-error" : undefined}
              className={`${fieldInput} mt-2`}
              aria-label="Loan amount in rupees"
            />
            {amountError ? (
              <p id="emi-amount-error" role="alert" className="mt-1 text-xs text-danger">
                {amountError}
              </p>
            ) : null}
          </div>

          <div>
            <label className={fieldLabel} htmlFor="emi-rate">
              Interest rate ({inputs.rate.toFixed(2)}% p.a.)
            </label>
            <input
              id="emi-rate"
              type="range"
              min={preset.rate.min}
              max={preset.rate.max}
              step={preset.rate.step}
              value={inputs.rate}
              onChange={(e) => commitField("rate", clamp(e.target.value, preset.rate.min, preset.rate.max, preset.rate.default))}
              className="w-full accent-primary"
            />
            <input
              type="number"
              inputMode="decimal"
              min={preset.rate.min}
              max={preset.rate.max}
              step={preset.rate.step}
              value={rate}
              onChange={setField("rate")}
              onBlur={() => commitField("rate", inputs.rate)}
              aria-invalid={Boolean(rateError)}
              aria-describedby={rateError ? "emi-rate-error" : undefined}
              className={`${fieldInput} mt-2`}
              aria-label="Interest rate percent per annum"
            />
            {rateError ? (
              <p id="emi-rate-error" role="alert" className="mt-1 text-xs text-danger">
                {rateError}
              </p>
            ) : null}
          </div>

          <div>
            <label className={fieldLabel} htmlFor="emi-tenure">
              Loan tenure ({inputs.tenureYears} {inputs.tenureYears === 1 ? "year" : "years"})
            </label>
            <input
              id="emi-tenure"
              type="range"
              min={preset.tenure.min}
              max={preset.tenure.max}
              step={preset.tenure.step}
              value={inputs.tenureYears}
              onChange={(e) => commitField("tenure", clamp(e.target.value, preset.tenure.min, preset.tenure.max, preset.tenure.default))}
              className="w-full accent-primary"
            />
            <input
              type="number"
              inputMode="numeric"
              min={preset.tenure.min}
              max={preset.tenure.max}
              step={preset.tenure.step}
              value={tenure}
              onChange={setField("tenure")}
              onBlur={() => commitField("tenure", inputs.tenureYears)}
              aria-invalid={Boolean(tenureError)}
              aria-describedby={tenureError ? "emi-tenure-error" : undefined}
              className={`${fieldInput} mt-2`}
              aria-label="Loan tenure in years"
            />
            {tenureError ? (
              <p id="emi-tenure-error" role="alert" className="mt-1 text-xs text-danger">
                {tenureError}
              </p>
            ) : null}
          </div>
        </form>

        <div className="rounded-2xl border border-border bg-surface p-6">
          <p className="text-sm text-text-muted">Monthly EMI</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-primary sm:text-4xl" aria-live="polite">
            {formatPrice(emi)}
          </p>

          <div className="mt-6 flex h-3 w-full overflow-hidden rounded-full bg-bg" aria-hidden>
            <div className="bg-primary" style={{ width: `${principalShare}%` }} />
            <div className="bg-accent" style={{ width: `${100 - principalShare}%` }} />
          </div>
          <div className="mt-3 flex justify-between text-sm">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
              Principal: {formatPrice(inputs.amount)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
              Interest: {formatPrice(totalInterest)}
            </span>
          </div>

          <dl className="mt-6 flex flex-col gap-3 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-text-muted">Total interest payable</dt>
              <dd className="font-medium">{formatPrice(totalInterest)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">Total payment (principal + interest)</dt>
              <dd className="font-medium">{formatPrice(totalPayment)}</dd>
            </div>
          </dl>

          <p className="mt-4 text-xs text-text-muted">
            Estimate only. Actual EMI depends on your lender&apos;s terms, processing fees, and rate type.
          </p>

          <Link
            href={`/tools/loans?${loansParams}`}
            className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Need help with a {type === "home" ? "home" : "personal"} loan? Request a callback
          </Link>
        </div>
      </div>

      <section aria-labelledby="emi-schedule-heading" className="rounded-2xl border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="emi-schedule-heading" className="text-lg font-semibold">
            Repayment schedule
          </h2>
          <div role="group" aria-label="Schedule view" className="inline-flex rounded-full border border-border p-1 text-xs font-semibold">
            {[
              ["off", "Hide"],
              ["yearly", "Yearly"],
              ["monthly", "Monthly"],
            ].map(([mode, text]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={scheduleMode === mode}
                onClick={() => setScheduleMode(mode)}
                className={`rounded-full px-3 py-1.5 ${scheduleMode === mode ? "bg-primary text-white" : "text-text hover:bg-bg"}`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        {scheduleMode === "off" ? (
          <p className="mt-2 text-sm text-text-muted">
            See how each instalment splits into principal and interest, and how the balance falls over time.
          </p>
        ) : (
          <div className="mt-4 max-h-96 overflow-auto rounded-xl border border-border" tabIndex={0} aria-label="Repayment schedule table, scrollable">
            <table className="w-full min-w-120 border-collapse text-right text-sm">
              <caption className="sr-only">
                {scheduleMode === "yearly" ? "Yearly" : "Monthly"} repayment schedule in rupees
              </caption>
              <thead className="sticky top-0 bg-bg text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 text-left font-medium">{scheduleMode === "yearly" ? "Year" : "Month"}</th>
                  <th scope="col" className="px-3 py-2 font-medium">Opening balance</th>
                  <th scope="col" className="px-3 py-2 font-medium">Principal repaid</th>
                  <th scope="col" className="px-3 py-2 font-medium">Interest paid</th>
                  <th scope="col" className="px-3 py-2 font-medium">Closing balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.key} className="border-t border-border">
                    <th scope="row" className="px-3 py-2 text-left font-medium">{row.label}</th>
                    <td className="px-3 py-2">{rupees(row.opening)}</td>
                    <td className="px-3 py-2">{rupees(row.principalPaid)}</td>
                    <td className="px-3 py-2">{rupees(row.interest)}</td>
                    <td className="px-3 py-2">{rupees(row.closing)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
