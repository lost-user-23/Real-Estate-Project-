import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/Container";
import { CheckBadgeIcon, MapPinIcon, SearchIcon } from "@/components/icons";

export const metadata = {
  title: "About us",
  description: "Why HomeNest exists and how we approach listing reviews.",
};

const PRINCIPLES = [
  {
    icon: SearchIcon,
    title: "Get to a search fast",
    description: "No account required to browse. Pick a tab, enter a location, and you're at results.",
  },
  {
    icon: CheckBadgeIcon,
    title: "Review before publish",
    description: "Every listing passes an admin checklist for accurate details, photos, and address before it's live.",
  },
  {
    icon: MapPinIcon,
    title: "Direct contact",
    description: "Reach owners and agents directly — no middleman, no proxy numbers.",
  },
];

export default function AboutPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="About us"
        title="Find the right place, without the noise."
        description="HomeNest is a property platform built around one idea: search should be fast, and listings should be reviewed before you see them."
      />
      <div className="py-10 sm:py-14">
        <Container className="max-w-3xl">
          <p className="text-text-muted">
            We started HomeNest because too much time gets spent scrolling past listings that turn out to be
            outdated, mislabelled, or missing basic details. Our review checklist checks that a listing&apos;s
            details, photos, and address match before it goes live &mdash; it&apos;s a small thing, but it changes
            how much you can trust the first page of results.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title} className="rounded-2xl border border-border bg-surface p-5">
                <principle.icon className="h-7 w-7 text-primary" aria-hidden />
                <p className="mt-3 font-semibold">{principle.title}</p>
                <p className="mt-1 text-sm text-text-muted">{principle.description}</p>
              </div>
            ))}
          </div>
        </Container>
      </div>
    </PageShell>
  );
}
