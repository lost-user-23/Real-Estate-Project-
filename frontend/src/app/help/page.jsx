import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/Container";

export const metadata = {
  title: "Help centre",
  description: "Common questions about searching, saving, and posting properties on HomeNest.",
};

const TOPICS = [
  {
    title: "Searching for a property",
    description: "How location search, filters, and budget presets work.",
    href: "/faqs#searching",
  },
  {
    title: "Saving properties",
    description: "Why you need an account to save a listing, and where saved properties show up.",
    href: "/faqs#saving",
  },
  {
    title: "Posting a listing",
    description: "What happens after you submit a listing, and how long review takes.",
    href: "/faqs#posting",
  },
  {
    title: "Verified and Featured badges",
    description: "What each badge confirms — and what it doesn't.",
    href: "/legal/verified-policy",
  },
];

export default function HelpPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="Support" title="Help centre" description="Find an answer, or reach us directly." />
      <div className="py-10 sm:py-14">
        <Container>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {TOPICS.map((topic) => (
              <Link
                key={topic.title}
                href={topic.href}
                className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary hover:bg-primary-light"
              >
                <p className="font-semibold">{topic.title}</p>
                <p className="mt-1 text-sm text-text-muted">{topic.description}</p>
              </Link>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-surface p-5">
            <p className="font-semibold">Still stuck?</p>
            <p className="mt-1 text-sm text-text-muted">
              Read the full{" "}
              <Link href="/faqs" className="text-primary hover:underline">
                FAQ list
              </Link>{" "}
              or{" "}
              <Link href="/contact" className="text-primary hover:underline">
                contact us
              </Link>{" "}
              directly.
            </p>
          </div>
        </Container>
      </div>
    </PageShell>
  );
}
