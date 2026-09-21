import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/Container";
import { LegalSections } from "@/components/legal/LegalSections";

export const metadata = {
  title: "Terms of service",
  description: "The terms that govern using HomeNest to search, save, and post property listings.",
};

const SECTIONS = [
  {
    heading: "Using HomeNest",
    paragraphs: [
      "HomeNest lets you search property listings for sale and rent, save listings you're interested in, and contact owners or agents directly. Posting a listing requires a free account.",
      "You're responsible for the accuracy of anything you submit, including listing details and contact information.",
    ],
  },
  {
    heading: "Listings and review",
    paragraphs: [
      "Every listing goes through an admin review checklist before it's marked Verified. Verified confirms that the details, photos, and address match what's listed — it does not confirm ownership or title.",
      "We may remove a listing at any time if it doesn't meet our content guidelines or is reported as inaccurate.",
    ],
  },
  {
    heading: "Accounts",
    paragraphs: [
      "You're responsible for keeping your account credentials secure. Contact support if you believe your account has been accessed without your permission.",
    ],
  },
  {
    heading: "Changes to these terms",
    paragraphs: [
      "We may update these terms as the product changes. Material changes will be reflected here with an updated date.",
    ],
  },
];

export default function TermsPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="Legal" title="Terms of service" description="Last updated September 2026." />
      <div className="py-10 sm:py-14">
        <Container className="max-w-3xl">
          <LegalSections sections={SECTIONS} />
        </Container>
      </div>
    </PageShell>
  );
}
