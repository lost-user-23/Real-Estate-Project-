import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/Container";
import { LegalSections } from "@/components/legal/LegalSections";

export const metadata = {
  title: "Verified listing policy",
  description: "What the Verified badge on a HomeNest listing means, and what it doesn't.",
};

const SECTIONS = [
  {
    heading: "What Verified means",
    paragraphs: [
      "A listing is marked Verified once it passes our admin review checklist: the details, photos, and address are checked against what's listed before the badge is applied.",
    ],
  },
  {
    heading: "What Verified does not mean",
    paragraphs: [
      "Verified does not confirm ownership or title. We don't store or check ownership documents as part of this review.",
      "It's a check on listing accuracy, not a legal or financial guarantee. You should independently verify ownership and title before entering into any transaction.",
    ],
  },
  {
    heading: "Featured listings",
    paragraphs: [
      "Featured is separate from Verified. It means an admin chose to promote the listing on the home page — there's no paid placement involved. A listing can be both Featured and Verified.",
    ],
  },
  {
    heading: "Reporting a listing",
    paragraphs: [
      "If something about a Verified listing looks wrong, use the Report a listing link in the footer and we'll take another look.",
    ],
  },
];

export default function VerifiedPolicyPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="Legal" title="Verified listing policy" description="Last updated September 2026." />
      <div className="py-10 sm:py-14">
        <Container className="max-w-3xl">
          <LegalSections sections={SECTIONS} />
        </Container>
      </div>
    </PageShell>
  );
}
