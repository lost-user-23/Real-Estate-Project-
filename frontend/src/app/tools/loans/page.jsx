import { Suspense } from "react";
import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/Container";
import { LenderComparison } from "@/components/tools/LenderComparison";
import { LoanEnquiryForm } from "@/components/tools/LoanEnquiryForm";

export const metadata = {
  title: "Home & personal loans",
  description:
    "Find official home loan and personal loan pages from major lenders, estimate your EMI, and request a callback. Information only, not a loan application.",
};

export default function LoansPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Tools"
        title="Home & personal loans"
        description="Compare where to look, check your EMI, and ask our team to call you back."
      />
      <div className="flex flex-col gap-14 py-10 sm:py-14">
        <Container className="max-w-4xl">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-6">
              <h2 className="text-lg font-semibold">Home loans</h2>
              <p className="mt-2 text-sm text-text-muted">
                A home loan is typically used to buy, build or renovate a property, with the property itself as
                security and a long repayment period of up to a few decades.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-6">
              <h2 className="text-lg font-semibold">Personal loans</h2>
              <p className="mt-2 text-sm text-text-muted">
                A personal loan is usually unsecured and shorter, often used for furnishing, moving or other
                expenses around a home purchase. It generally carries a higher interest rate than a home loan.
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm">
            Want to see the monthly cost first?{" "}
            <Link href="/tools/emi-calculator" className="font-medium text-primary underline underline-offset-2">
              Open the EMI calculator
            </Link>
            .
          </p>
          <p
            role="note"
            className="mt-6 rounded-2xl border border-border bg-bg p-4 text-sm text-text-muted"
          >
            <strong className="text-text">Please note:</strong> HomeNest is not a lender, and this page is not a loan
            application. The lenders below are listed for information, with links to their own public pages;
            listing does not imply a partnership or endorsement. Requesting a callback here only asks the HomeNest
            team to contact you, and nothing is submitted to any lender.
          </p>
        </Container>

        <Container className="max-w-5xl">
          <h2 className="text-2xl font-semibold tracking-tight">Lenders&apos; official pages</h2>
          <p className="mt-1 mb-6 text-sm text-text-muted">
            Apply directly on the lender&apos;s own website. Links open in a new tab.
          </p>
          <LenderComparison />
        </Container>

        <Container className="max-w-2xl">
          <h2 id="callback" className="text-2xl font-semibold tracking-tight">
            Request a callback
          </h2>
          <p className="mt-1 mb-6 text-sm text-text-muted">
            Tell us what you are looking for and our team will get in touch. We ask only for the details below.
          </p>
          <Suspense fallback={<p className="text-sm text-text-muted">Loading form…</p>}>
            <LoanEnquiryForm />
          </Suspense>
        </Container>
      </div>
    </PageShell>
  );
}
