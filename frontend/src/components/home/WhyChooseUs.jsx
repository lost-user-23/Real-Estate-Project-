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
          <div key={benefit.title} className="rounded-2xl border border-border bg-bg p-5">
            <benefit.icon className="h-8 w-8 text-primary" aria-hidden />
            <p className="mt-4 font-semibold">{benefit.title}</p>
            <p className="mt-1 text-sm text-text-muted">{benefit.description}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}
