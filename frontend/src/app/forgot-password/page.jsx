import { Suspense } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { ForgotPasswordContent } from "@/components/account/ForgotPasswordContent";

export const metadata = {
  title: "Reset Your Password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <PageShell>
      <Suspense fallback={null}>
        <ForgotPasswordContent />
      </Suspense>
    </PageShell>
  );
}
