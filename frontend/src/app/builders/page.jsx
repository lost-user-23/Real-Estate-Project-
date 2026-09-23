import { Suspense } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { BuildersDirectory } from "@/components/builders/BuildersDirectory";

export const metadata = {
  title: "Builders & Developers",
  description: "Browse popular builders and developers, and every listed project grouped by builder and brand.",
};

export default function BuildersPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Developers"
        title="Builders & developers"
        description="Find the builders active near you, and browse their projects grouped by brand."
      />
      <Suspense fallback={null}>
        <BuildersDirectory />
      </Suspense>
    </PageShell>
  );
}
