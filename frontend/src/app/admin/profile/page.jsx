"use client";

import { useAdminAuth } from "@/lib/admin-auth-context";
import {
  AccountDetailsForm,
  ChangeEmailForm,
  ChangePasswordForm,
  DeleteAccountSection,
} from "@/components/account/AccountSections";

// Same account forms and endpoints as the public /profile page (shared
// session, /api/auth/*). The admin shell already guards this route.
export default function AdminProfilePage() {
  const { user } = useAdminAuth();

  return (
    <div className="flex max-w-lg flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-text-muted">
          Signed in as {user?.email} ({user?.role}).
        </p>
      </div>
      <div key={user?.id ?? "session"} className="flex flex-col gap-6">
        <AccountDetailsForm />
        <ChangePasswordForm />
        <ChangeEmailForm />
        <DeleteAccountSection redirectTo="/" />
      </div>
    </div>
  );
}
