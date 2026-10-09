import Link from "next/link";
import { ManageConsentLink } from "@/components/ManageConsentLink";
import { Container } from "@/components/ui/Container";
import { PostPropertyButton } from "@/components/PostPropertyButton";

const FOOTER_GROUPS = [
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Insights", href: "/#insights" },
      { label: "Contact us", href: "/contact" },
    ],
  },
  {
    title: "Property",
    links: [
      { label: "Buy", href: "/search?intent=buy" },
      { label: "Rent", href: "/search?intent=rent" },
      { label: "New Projects", href: "/#new-projects" },
      { label: "Commercial", href: "/search?propertyType=commercial" },
    ],
  },
  {
    title: "Tools",
    links: [
      { label: "EMI calculator", href: "/tools/emi-calculator" },
      { label: "Property value estimator", href: "/tools/property-value-calculator" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help centre", href: "/help" },
      { label: "FAQs", href: "/faqs" },
      { label: "Report a listing", href: "/report" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Terms of service", href: "/legal/terms" },
      { label: "Privacy policy", href: "/legal/privacy" },
      { label: "Verified listing policy", href: "/legal/verified-policy" },
    ],
  },
];

const SOCIAL_LINKS = [
  { label: "HomeNest on Instagram", href: "https://instagram.com" },
  { label: "HomeNest on LinkedIn", href: "https://linkedin.com" },
  { label: "HomeNest on X", href: "https://x.com" },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <Container className="py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-7">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-primary">
              <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
                H
              </span>
              HomeNest
            </Link>
            <p className="mt-3 max-w-xs text-sm text-text-muted">
              Search reviewed listings for sale and rent, and contact owners and agents directly.
            </p>
            <PostPropertyButton source="footer" className="mt-4" variant="outline" />
          </div>

          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-semibold">{group.title}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-text-muted hover:text-primary">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-text-muted">
            &copy; {new Date().getFullYear()} HomeNest. All rights reserved.
          </p>
          <ManageConsentLink />
          <div className="flex items-center gap-3">
            {SOCIAL_LINKS.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-muted hover:border-primary hover:text-primary"
              >
                <span aria-hidden className="text-xs font-semibold">
                  {social.label.split(" ").pop()?.[0]}
                </span>
              </a>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}
