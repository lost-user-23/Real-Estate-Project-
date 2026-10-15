import { Suspense } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { PostPropertyForm } from "@/components/post-property/PostPropertyForm";
import { CheckBadgeIcon, KeyIcon, TrendingUpIcon } from "@/components/icons";

export const metadata = {
  title: "Post Property",
  description: "List your property and reach interested buyers and tenants.",
};

const PERKS = [
  { icon: CheckBadgeIcon, label: "Post property for free" },
  { icon: TrendingUpIcon, label: "Get verified buyers" },
  { icon: KeyIcon, label: "Get personalised assistance on selling faster" },
];

const TESTIMONIALS = [
  {
    name: "Anil Kumar",
    role: "Owner • 2 BHK, Delhi",
    quote:
      "I listed my flat in a few minutes and had genuine enquiries within days. The whole process was smooth and my property was rented out quickly.",
  },
  {
    name: "Utkarsh Pratap Singh",
    role: "Owner • 3 BHK, Pune",
    quote:
      "I recently listed my 3BHK apartment and the experience was nothing short of exceptional. Great response from verified buyers.",
  },
];

const initials = (name) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

export default function PostPropertyPage() {
  return (
    <PageShell>
      <section className="relative isolate overflow-hidden bg-linear-to-b from-primary via-primary-dark to-primary-dark lg:rounded-b-[6rem]">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
              backgroundSize: "22px 22px",
            }}
          />
        </div>

        <Container>
          <div className="grid items-start gap-10 py-10 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-16">
            <div className="text-white lg:pt-10">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl lg:leading-[1.1]">
                Sell or rent your property{" "}
                <span className="relative inline-block text-accent">
                  faster
                  <svg
                    aria-hidden
                    viewBox="0 0 120 8"
                    preserveAspectRatio="none"
                    className="absolute -bottom-1 left-0 h-2 w-full"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M2 6C30 2 70 2 118 5" />
                  </svg>
                </span>{" "}
                with us
              </h1>

              <ul className="mt-8 space-y-4">
                {PERKS.map((perk) => (
                  <li key={perk.label} className="flex items-center gap-3 text-lg font-semibold text-white/95">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
                      <perk.icon className="h-4 w-4" />
                    </span>
                    {perk.label}
                  </li>
                ))}
              </ul>

              <div className="mt-10 hidden gap-4 md:grid md:grid-cols-2">
                {TESTIMONIALS.map((t) => (
                  <figure key={t.name} className="rounded-2xl bg-white p-5 text-text shadow-lg shadow-black/10">
                    <figcaption className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {initials(t.name)}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold">{t.name}</span>
                        <span className="block text-xs text-text-muted">{t.role}</span>
                      </span>
                    </figcaption>
                    <blockquote className="mt-3 text-sm leading-relaxed text-text-muted">{t.quote}</blockquote>
                  </figure>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl bg-surface shadow-2xl shadow-black/20">
              <div className="border-b border-border bg-primary/5 px-6 py-3">
                <p className="text-base font-bold text-primary">Owner</p>
              </div>
              <div className="p-6 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
                <p className="mb-4 text-sm text-text-muted">
                  Give us the details below. Every listing is reviewed before it goes live.
                </p>
                <Suspense fallback={null}>
                  <PostPropertyForm />
                </Suspense>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </PageShell>
  );
}
