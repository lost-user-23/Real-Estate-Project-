import { Suspense } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/Container";
import { ReportListingForm } from "@/components/report/ReportListingForm";

export const metadata = {
  title: "Report a listing",
  description: "Flag a listing that looks outdated, incorrect, or duplicated.",
};

export default function ReportPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Support"
        title="Report a listing"
        description="Spotted something wrong with a Verified listing? Let us know and we'll take another look."
      />
      <div className="py-10 sm:py-14">
        <Container className="max-w-2xl">
          <Suspense fallback={null}>
            <ReportListingForm />
          </Suspense>
        </Container>
      </div>
    </PageShell>
  );
}
