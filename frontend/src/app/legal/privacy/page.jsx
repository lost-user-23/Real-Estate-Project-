import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/Container";
import { LegalSections } from "@/components/legal/LegalSections";

export const metadata = {
  title: "Privacy policy",
  description: "What HomeNest collects, why, and how it's used.",
};

const SECTIONS = [
  {
    heading: "What we collect",
    paragraphs: [
      "Account details you provide when you sign up (name, email, phone number), listings you post, properties you save, and basic analytics about how the site is used (see the cookie notice on the home page).",
      "The home page itself doesn't collect phone numbers or other personal information directly — that happens when you create an account or post a listing.",
    ],
  },
  {
    heading: "How we use it",
    paragraphs: [
      "To operate search, show your saved properties, let owners and agents manage their listings, and understand which parts of the site are actually used so we can improve them.",
      "Your phone number is only shared with a logged-in visitor who chooses to view it on a listing you've posted — it's never included in the page's raw HTML for anonymous visitors.",
    ],
  },
  {
    heading: "Cookies",
    paragraphs: [
      "We use a small number of analytics cookies. You can dismiss the notice on the home page once you've seen it; this doesn't opt you out of essential cookies needed to keep you logged in.",
    ],
  },
  {
    heading: "Your choices",
    paragraphs: [
      "You can request a copy of your data or ask us to delete your account by contacting support.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="Legal" title="Privacy policy" description="Last updated September 2026." />
      <div className="py-10 sm:py-14">
        <Container className="max-w-3xl">
          <LegalSections sections={SECTIONS} />
        </Container>
      </div>
    </PageShell>
  );
}
