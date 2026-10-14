"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLoginPrompt } from "@/lib/login-prompt-context";
import {
  AccountDetailsForm,
  ChangeEmailForm,
  ChangePasswordForm,
  DeleteAccountSection,
} from "@/components/account/AccountSections";
import { MyListings } from "@/components/account/MyListings";
import { MyReports } from "@/components/account/MyReports";

// Public-site profile. Logged-out visitors are sent home (with the login
// dialog if they never had a session this visit); if the session ends while
// they are on the page (logout, account deleted, expired token) they are sent
// home quietly.
export function ProfileContent() {
  const router = useRouter();
  const { isLoggedIn, loading, user } = useAuth();
  const { requestLogin } = useLoginPrompt();
  const hadSessionRef = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (isLoggedIn) {
      hadSessionRef.current = true;
      return;
    }
    router.replace("/");
    if (!hadSessionRef.current) requestLogin(() => router.push("/profile"));
  }, [loading, isLoggedIn, router, requestLogin]);

  if (loading || !isLoggedIn) {
    return <p className="text-sm text-text-muted">Loading your account…</p>;
  }

  // Keyed by user id so the forms re-seed if a different account signs in.
  return (
    <div key={user?.id ?? "session"} className="flex flex-col gap-6">
      <AccountDetailsForm />
      <MyListings />
      <MyReports />
      <ChangePasswordForm />
      <ChangeEmailForm />
      <DeleteAccountSection />
    </div>
  );
}
