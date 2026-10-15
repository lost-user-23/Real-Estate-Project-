import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { PropertyFinderChat } from "@/components/assistant/PropertyFinderChat";

export const metadata = {
  title: "Property Finder",
  description:
    "Tell HomeNest what you want to buy or rent and get matches from our live listings, step by step or in one message.",
};

export default function PropertyFinderPage() {
  return (
    <PageShell>
      <Container className="max-w-3xl pt-4">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Find the right place, step by step</h1>
        <p className="mb-3 mt-1 text-sm text-text-muted">
          Answer a few quick questions or describe what you want. Every result is a real, published HomeNest listing.
        </p>
        <PropertyFinderChat variant="page" />
      </Container>
    </PageShell>
  );
}
