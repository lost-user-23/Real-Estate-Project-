import { Suspense } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { VerifyEmailContent } from "@/components/account/VerifyEmailContent";

export const metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
  // The link carries a secret token; never leak it through the Referer header.
  referrer: "no-referrer",
};

export default function VerifyEmailPage() {
  return (
    <PageShell>
      <Suspense fallback={null}>
        <VerifyEmailContent />
      </Suspense>
    </PageShell>
  );
}
