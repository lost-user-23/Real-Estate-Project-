import { Suspense } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { SearchResults } from "@/components/search/SearchResults";

export const metadata = {
  title: "Search properties",
  description: "Browse reviewed listings for sale and rent by city, locality, type, and budget.",
};

export default function SearchPage() {
  return (
    <PageShell>
      <Suspense fallback={null}>
        <SearchResults />
      </Suspense>
    </PageShell>
  );
}
