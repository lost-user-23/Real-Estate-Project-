"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { enquiryMessage } from "@/lib/assistantLinks.mjs";

const PHONE_RE = /^\+?\d{7,15}$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

// Shown to the visitor next to the checkbox. Nothing is sent until they tick it
// and press the button, and the finder itself never sees these details: the
// form posts straight to the existing contact-message endpoint.
const CONSENT_TEXT =
  "I agree that HomeNest may contact me by phone or email about this property. I understand this sends my details to HomeNest only.";

const field =
  "w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary";

export function EnquiryForm({ property, onDone, onCancel }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    message: enquiryMessage(property),
    consent: false,
    website: "",
  });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  // A ref, not state: repeated clicks in the same tick all see the old state value.
  const sendingRef = useRef(false);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    if (sendingRef.current) return;
    const phone = form.phone.replace(/[\s\-()]/g, "");
    if (form.name.trim().length < 2) return setError("Please enter your name.");
    if (!EMAIL_RE.test(form.email.trim())) return setError("Please enter a valid email address.");
    if (phone && !PHONE_RE.test(phone)) return setError("Please enter a valid phone number, or leave it empty.");
    if (form.message.trim().length < 10) return setError("Please write at least a short message.");
    if (!form.consent) return setError("Please tick the box to agree to be contacted.");

    setError("");
    sendingRef.current = true;
    setSending(true);
    try {
      await api.post(
        "/api/v1/contact-messages",
        {
          name: form.name.trim(),
          email: form.email.trim(),
          phone,
          message: form.message.trim(),
          website: form.website,
        },
        { auth: false }
      );
      onDone(property);
    } catch (requestError) {
      setError(requestError.message || "Your request could not be sent. Please try again.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl border border-primary/30 bg-surface p-3" aria-label="Request a callback">
      <h3 className="text-sm font-bold">Request a callback about &ldquo;{property.title}&rdquo;</h3>
      <input aria-label="Your name" placeholder="Your name" value={form.name} onChange={set("name")} className={field} autoComplete="name" />
      <input aria-label="Email" type="email" placeholder="Email" value={form.email} onChange={set("email")} className={field} autoComplete="email" />
      <input aria-label="Phone (optional)" type="tel" placeholder="Phone (optional)" value={form.phone} onChange={set("phone")} className={field} autoComplete="tel" />
      <textarea aria-label="Message" rows={3} value={form.message} onChange={set("message")} className={field} />
      {/* Honeypot: hidden from people, filled by bots. */}
      <input tabIndex={-1} autoComplete="off" aria-hidden value={form.website} onChange={set("website")} className="hidden" name="website" />
      <label className="flex items-start gap-2 text-xs text-text-muted">
        <input
          type="checkbox"
          checked={form.consent}
          onChange={(event) => setForm((prev) => ({ ...prev, consent: event.target.checked }))}
          className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
        />
        {CONSENT_TEXT}
      </label>
      {error ? <p role="alert" className="text-xs font-medium text-danger">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={sending}
          className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
        >
          {sending ? "Sending..." : "Send request"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-border px-4 py-2 text-xs font-semibold">
          Cancel
        </button>
      </div>
    </form>
  );
}
