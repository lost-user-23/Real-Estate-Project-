"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { lendersForType } from "@/lib/lenders.mjs";
import { LOAN_PRESETS, LOAN_TYPES, parseLoanQuery } from "@/lib/loanMath.mjs";

// Must match CONSENT_TEXT_VERSIONS in backend/src/utils/loanEnquiryValidation.js.
// DRAFT wording: needs business/legal approval before launch. Change the
// version string (on both sides) whenever the wording changes.
export const CONSENT_TEXT_VERSION = "loan-callback-2026-10-draft";
const CONSENT_TEXT =
  "I agree that HomeNest may contact me by phone or email about this loan enquiry. I understand this is a callback request, not a loan application, and that my details are not shared with any lender without a further step I agree to.";

const MIN_AMOUNT = 10_000;
const MAX_AMOUNT = 500_000_000;
const PHONE_RE = /^\+?\d{7,15}$/;

const label = "mb-1.5 block text-xs font-medium text-text-muted";
const input =
  "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary";

export function LoanEnquiryForm() {
  const searchParams = useSearchParams();
  const { show } = useToast();
  const query = parseLoanQuery(searchParams);
  const rawPropertyId = searchParams.get("propertyId");
  const propertyId = rawPropertyId && /^[a-f\d]{24}$/i.test(rawPropertyId) ? rawPropertyId : "";

  const [form, setForm] = useState(() => ({
    name: "",
    phone: "",
    email: "",
    loanType: query.type,
    amount: String(query.amount ?? LOAN_PRESETS[query.type].amount.default),
    city: "",
    preferredLenderId: "",
    consent: false,
    website: "",
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState("");

  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const validate = () => {
    const next = {};
    const phone = form.phone.replace(/[\s\-()]/g, "");
    const amount = Number(form.amount);
    if (form.name.trim().length < 2) next.name = "Enter your name (at least 2 characters).";
    if (!PHONE_RE.test(phone)) next.phone = "Enter a valid phone number (7 to 15 digits).";
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = "Enter a valid email address.";
    if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      next.amount = "Enter an amount between ₹10,000 and ₹50 crore.";
    }
    if (!form.consent) next.consent = "Please tick the box to agree to be contacted.";
    return next;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        loanType: form.loanType,
        amountInRupees: Number(form.amount),
        consent: { accepted: true, textVersion: CONSENT_TEXT_VERSION },
        website: form.website,
      };
      if (form.email.trim()) body.email = form.email.trim();
      if (form.city.trim()) body.city = form.city.trim();
      if (form.preferredLenderId) body.preferredLenderId = form.preferredLenderId;
      if (propertyId) body.propertyId = propertyId;
      // auth: false keeps a public endpoint's 401 from touching the session.
      const data = await api.post("/api/v1/loan-enquiries", body, { auth: false });
      setReference(data?.referenceId || "");
      show("Request received. We'll be in touch.");
    } catch (e) {
      const message = e?.message || "Your request could not be sent. Please try again.";
      setFormError(message);
      show(message, { error: true });
    } finally {
      setSubmitting(false);
    }
  };

  if (reference) {
    return (
      <div role="status" className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="font-semibold">Thanks, we have your request.</p>
        <p className="mt-1 text-sm text-text-muted">
          Our team will contact you by phone or email. This is a callback request only, not a loan application.
        </p>
        <p className="mt-3 text-xs text-text-muted">
          Reference: <span className="font-mono">{reference}</span>
        </p>
      </div>
    );
  }

  const lenderOptions = lendersForType(form.loanType);
  const errorText = (key) =>
    errors[key] ? (
      <p id={`loan-${key}-error`} role="alert" className="mt-1 text-xs text-danger">
        {errors[key]}
      </p>
    ) : null;
  const a11y = (key) => ({
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `loan-${key}-error` : undefined,
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="relative flex flex-col gap-4" aria-label="Loan callback request">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="loan-name">Name</label>
          <input id="loan-name" type="text" autoComplete="name" maxLength={80} value={form.name} onChange={set("name")} className={input} {...a11y("name")} />
          {errorText("name")}
        </div>
        <div>
          <label className={label} htmlFor="loan-phone">Phone</label>
          <input id="loan-phone" type="tel" autoComplete="tel" maxLength={16} value={form.phone} onChange={set("phone")} className={input} {...a11y("phone")} />
          {errorText("phone")}
        </div>
        <div>
          <label className={label} htmlFor="loan-email">Email (optional)</label>
          <input id="loan-email" type="email" autoComplete="email" maxLength={254} value={form.email} onChange={set("email")} className={input} {...a11y("email")} />
          {errorText("email")}
        </div>
        <div>
          <label className={label} htmlFor="loan-city">City (optional)</label>
          <input id="loan-city" type="text" autoComplete="address-level2" maxLength={80} value={form.city} onChange={set("city")} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="loan-type">Loan type</label>
          <select
            id="loan-type"
            value={form.loanType}
            onChange={(e) => setForm((prev) => ({ ...prev, loanType: e.target.value, preferredLenderId: "" }))}
            className={input}
          >
            {LOAN_TYPES.map((t) => (
              <option key={t} value={t}>{LOAN_PRESETS[t].label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="loan-amount">Loan amount needed (₹)</label>
          <input id="loan-amount" type="number" inputMode="numeric" min={MIN_AMOUNT} max={MAX_AMOUNT} value={form.amount} onChange={set("amount")} className={input} {...a11y("amount")} />
          {errorText("amount")}
        </div>
      </div>
      <div>
        <label className={label} htmlFor="loan-lender">Preferred lender (optional)</label>
        <select id="loan-lender" value={form.preferredLenderId} onChange={set("preferredLenderId")} className={input}>
          <option value="">No preference</option>
          {lenderOptions.map((lender) => (
            <option key={lender.id} value={lender.id}>{lender.name}</option>
          ))}
        </select>
      </div>

      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set("website")} />
        </label>
      </div>

      <div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(e) => setForm((prev) => ({ ...prev, consent: e.target.checked }))}
            className="mt-1 h-4 w-4 accent-primary"
            {...a11y("consent")}
          />
          <span>
            {CONSENT_TEXT}{" "}
            <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-primary">
              Read how we handle your information
            </Link>
            .
          </span>
        </label>
        {errorText("consent")}
      </div>

      {formError ? (
        <p role="alert" className="text-sm text-danger">{formError}</p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {submitting ? "Sending..." : "Request a callback"}
      </button>
      <p className="text-xs text-text-muted">
        Submitting this form does not apply for a loan with any bank. We collect only the details above.
      </p>
    </form>
  );
}
