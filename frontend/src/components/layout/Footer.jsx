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
    <footer className="bg-ink text-white">
      <Container className="py-12">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-7">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-white">
              <span aria-hidden className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-primary to-[#12a09e] text-white">
                H
              </span>
              HomeNest
            </Link>
            <p className="mt-3 max-w-xs text-sm text-white/65">
              Search reviewed listings for sale and rent, and contact owners and agents directly.
            </p>
            <PostPropertyButton source="footer" className="mt-4" variant="solid" />
          </div>

          {FOOTER_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-bold tracking-wide text-accent uppercase">{group.title}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="text-sm text-white/70 transition-colors hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-white/60">
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
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-accent hover:bg-accent hover:text-accent-ink"
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
