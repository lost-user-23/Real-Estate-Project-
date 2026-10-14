import { CheckBadgeIcon, MapPinIcon, SearchIcon, StarIcon } from "@/components/icons";
import { Section } from "@/components/ui/Section";

// Each benefit maps to something the platform actually does, matching the
// Verified/Featured definitions in PRD §6 - no ownership/title claims.
const BENEFITS = [
  {
    icon: CheckBadgeIcon,
    title: "Every listing passes an admin review",
    description: "Details, photos, and the address are checked against the listing before it goes live.",
  },
  {
    icon: SearchIcon,
    title: "Search that gets to results fast",
    description: "Pick a tab, enter a location, and you're at a filtered results page in two steps.",
  },
  {
    icon: StarIcon,
    title: "Featured picks, clearly labelled",
    description: "Promoted listings are marked Featured so you always know why a card is standing out.",
  },
  {
    icon: MapPinIcon,
    title: "Coverage across major cities",
    description: "Buy, rent, or list across the areas people are actually searching.",
  },
];

export function WhyChooseUs() {
  return (
    <Section id="why-choose-us" title="Why choose us" tone="surface">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map((benefit) => (
          <div
            key={benefit.title}
            className="group relative overflow-hidden rounded-3xl border border-border bg-bg p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/40 hover:bg-surface hover:shadow-xl hover:shadow-primary/10"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/30 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3">
              <benefit.icon className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-5 text-lg font-semibold leading-snug">{benefit.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-text-muted">{benefit.description}</p>
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-linear-to-r from-primary to-accent transition-transform duration-300 group-hover:scale-x-100"
            />
          </div>
        ))}
      </div>
    </Section>
  );
}
