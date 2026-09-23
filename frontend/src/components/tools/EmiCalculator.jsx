"use client";

import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";

const fieldLabel = "mb-1.5 block text-xs font-medium text-text-muted";
const fieldInput =
  "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary";

function computeEmi(principal, annualRatePercent, tenureYears) {
  const months = tenureYears * 12;
  const monthlyRate = annualRatePercent / 12 / 100;
  if (months <= 0) return { emi: 0, totalPayment: 0, totalInterest: 0 };
  if (monthlyRate === 0) {
    const emi = principal / months;
    return { emi, totalPayment: principal, totalInterest: 0 };
  }
  const factor = Math.pow(1 + monthlyRate, months);
  const emi = (principal * monthlyRate * factor) / (factor - 1);
  const totalPayment = emi * months;
  return { emi, totalPayment, totalInterest: totalPayment - principal };
}

export function EmiCalculator() {
  const [principal, setPrincipal] = useState(5000000);
  const [rate, setRate] = useState(8.5);
  const [tenure, setTenure] = useState(20);

  const { emi, totalPayment, totalInterest } = useMemo(
    () => computeEmi(Number(principal) || 0, Number(rate) || 0, Number(tenure) || 0),
    [principal, rate, tenure]
  );

  const principalShare = totalPayment > 0 ? (Number(principal) / totalPayment) * 100 : 100;

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className={fieldLabel} htmlFor="emi-principal">
            Loan amount ({formatPrice(Number(principal) || 0)})
          </label>
          <input
            id="emi-principal"
            type="range"
            min={100000}
            max={50000000}
            step={100000}
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            className="w-full accent-primary"
          />
          <input
            type="number"
            min={0}
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            className={`${fieldInput} mt-2`}
            aria-label="Loan amount in rupees"
          />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="emi-rate">
            Interest rate ({Number(rate).toFixed(2)}% p.a.)
          </label>
          <input
            id="emi-rate"
            type="range"
            min={4}
            max={18}
            step={0.05}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-full accent-primary"
          />
          <input
            type="number"
            min={0}
            step={0.05}
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className={`${fieldInput} mt-2`}
            aria-label="Interest rate percent per annum"
          />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="emi-tenure">
            Loan tenure ({tenure} years)
          </label>
          <input
            id="emi-tenure"
            type="range"
            min={1}
            max={30}
            step={1}
            value={tenure}
            onChange={(e) => setTenure(e.target.value)}
            className="w-full accent-primary"
          />
          <input
            type="number"
            min={1}
            max={30}
            value={tenure}
            onChange={(e) => setTenure(e.target.value)}
            className={`${fieldInput} mt-2`}
            aria-label="Loan tenure in years"
          />
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm text-text-muted">Monthly EMI</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-primary sm:text-4xl">
          {formatPrice(Math.round(emi))}
        </p>

        <div className="mt-6 flex h-3 w-full overflow-hidden rounded-full bg-bg" aria-hidden>
          <div className="bg-primary" style={{ width: `${principalShare}%` }} />
          <div className="bg-accent" style={{ width: `${100 - principalShare}%` }} />
        </div>
        <div className="mt-3 flex justify-between text-sm">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
            Principal: {formatPrice(Math.round(Number(principal) || 0))}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
            Interest: {formatPrice(Math.round(totalInterest))}
          </span>
        </div>

        <dl className="mt-6 flex flex-col gap-3 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-muted">Total interest payable</dt>
            <dd className="font-medium">{formatPrice(Math.round(totalInterest))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">Total payment (principal + interest)</dt>
            <dd className="font-medium">{formatPrice(Math.round(totalPayment))}</dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-text-muted">
          Estimate only. Actual EMI depends on your lender&apos;s terms, processing fees, and rate type.
        </p>
      </div>
    </div>
  );
}
