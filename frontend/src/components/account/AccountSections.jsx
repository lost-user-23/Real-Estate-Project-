"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, request } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { AdminField, adminFieldInputClass } from "@/components/admin/AdminField";
import { Modal } from "@/components/admin/Modal";
import { useFormAction } from "@/components/account/useFormAction";

const MIN_PASSWORD_LENGTH = 8;

export function Section({ title, description, children }) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description ? <p className="mt-1 text-sm text-text-muted">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function FormFeedback({ status, message }) {
  if (status === "error") {
    return (
      <p role="alert" className="text-sm text-danger">
        {message}
      </p>
    );
  }
  if (status === "success") {
    return (
      <p role="status" className="text-sm text-success">
        {message}
      </p>
    );
  }
  return null;
}

function SubmitButton({ saving, children, danger = false, disabled = false }) {
  return (
    <button
      type="submit"
      disabled={saving || disabled}
      className={`rounded-full px-5 py-2 text-sm font-medium text-white disabled:opacity-60 ${
        danger ? "bg-danger hover:opacity-90" : "bg-primary hover:bg-primary-dark"
      }`}
    >
      {saving ? "Please wait…" : children}
    </button>
  );
}

export function AccountDetailsForm() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const action = useFormAction();

  const handleSubmit = async (event) => {
    event.preventDefault();
    await action.run(async () => {
      const { user: updated } = await api.patch("/api/auth/me", { name, phone });
      updateUser(updated);
      setName(updated.name ?? "");
      setPhone(updated.phone ?? "");
    }, "Details saved.");
  };

  return (
    <Section title="Account details" description="Your name and phone number.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AdminField label="Name">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            autoComplete="name"
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="Phone">
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            placeholder="+91 98765 43210"
            className={adminFieldInputClass}
          />
        </AdminField>
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton saving={action.saving}>Save changes</SubmitButton>
          <FormFeedback status={action.status} message={action.message} />
        </div>
      </form>
    </Section>
  );
}

export function ChangePasswordForm() {
  const { replaceSession } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const action = useFormAction();
  const mismatch = confirmPassword !== "" && confirmPassword !== newPassword;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) return;
    const { ok } = await action.run(async () => {
      const session = await api.post("/api/auth/change-password", { currentPassword, newPassword });
      // The server invalidated every earlier token; store the fresh one the same
      // way login does so this session keeps working.
      replaceSession(session);
    }, "Password changed. Other devices have been signed out.");
    if (ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <Section title="Change password" description="Changing your password signs you out everywhere else.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AdminField label="Current password">
          <input
            required
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label={`New password (min ${MIN_PASSWORD_LENGTH} characters)`}>
          <input
            required
            type="password"
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="Confirm new password">
          <input
            required
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={adminFieldInputClass}
          />
        </AdminField>
        {mismatch ? <p className="text-sm text-danger">Passwords do not match.</p> : null}
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton saving={action.saving} disabled={mismatch}>
            Change password
          </SubmitButton>
          <FormFeedback status={action.status} message={action.message} />
        </div>
      </form>
    </Section>
  );
}

export function ChangeEmailForm() {
  const { user, updateUser } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const action = useFormAction();

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { ok } = await action.run(async () => {
      const { user: updated } = await api.patch("/api/auth/change-email", { currentPassword, newEmail });
      updateUser(updated);
    }, "Email updated.");
    if (ok) {
      setNewEmail("");
      setCurrentPassword("");
    }
  };

  return (
    <Section title="Change email" description={`Current email: ${user?.email ?? "—"}`}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AdminField label="New email">
          <input
            required
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="Current password">
          <input
            required
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={adminFieldInputClass}
          />
        </AdminField>
        <div className="flex flex-wrap items-center gap-4">
          <SubmitButton saving={action.saving}>Change email</SubmitButton>
          <FormFeedback status={action.status} message={action.message} />
        </div>
      </form>
    </Section>
  );
}

export function DeleteAccountSection({ redirectTo = "/" }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const action = useFormAction();

  const close = () => {
    if (action.saving) return;
    setOpen(false);
    setPassword("");
    action.reset();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { ok } = await action.run(
      // The DELETE carries the password in its JSON body (api.delete accepts one too, via opts.body).
      () => request("/api/auth/me", { method: "DELETE", body: { password } }),
      "Account deleted."
    );
    if (ok) {
      logout();
      router.replace(redirectTo);
    }
  };

  return (
    <Section
      title="Delete account"
      description="Permanently deletes your account and all of your listings. This cannot be undone."
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-danger px-5 py-2 text-sm font-medium text-danger hover:bg-danger/10"
      >
        Delete my account
      </button>
      {open ? (
        <Modal title="Delete your account?" onClose={close}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <p className="text-sm text-text-muted">
              This deletes your account and every listing you have posted. Enter your password to confirm.
            </p>
            <AdminField label="Password">
              <input
                required
                autoFocus
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={adminFieldInputClass}
              />
            </AdminField>
            <FormFeedback status={action.status === "success" ? "idle" : action.status} message={action.message} />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={close}
                disabled={action.saving}
                className="rounded-full px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg"
              >
                Cancel
              </button>
              <SubmitButton saving={action.saving} danger>
                Delete account
              </SubmitButton>
            </div>
          </form>
        </Modal>
      ) : null}
    </Section>
  );
}
