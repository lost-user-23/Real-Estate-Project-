import { Suspense } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { SearchResults } from "@/components/search/SearchResults";
import { SearchAnalytics } from "@/components/search/SearchAnalytics";

export const metadata = {
  title: "Search properties",
  description: "Browse reviewed listings for sale and rent by city, locality, type, and budget.",
};

export default function SearchPage() {
  return (
    <PageShell>
      <Suspense fallback={null}>
        <SearchResults />
        <SearchAnalytics />
      </Suspense>
    </PageShell>
  );
}
