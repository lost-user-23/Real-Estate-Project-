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
      "The home page itself doesn't collect phone numbers or other personal information directly — that happens when you create an account, post a listing, send a contact message, or request a loan callback.",
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
    heading: "Loan callback requests (PROPOSED WORDING: pending business/legal approval)",
    paragraphs: [
      "What we collect: if you use the callback form on the loans page, we collect your name, phone number, the loan type and amount you are interested in, and, only if you choose to give them, your email address, city, a preferred lender and the property you were viewing. We also record the version of the consent wording you agreed to, the time you agreed, and your IP address (kept privately, for abuse prevention).",
      "Why we collect it: to contact you about your loan enquiry. The tick-box is unticked by default, is specific to this callback, and is not marketing consent. You can still use the calculators and read the lender pages without submitting anything.",
      "How we use it: our team uses these details to call or email you about the enquiry and to review requests in our admin tools. This is a callback request, not a loan application, and we do not submit anything to a bank on your behalf.",
      "Sharing: we do not currently share these details with any lender or partner. If that changes, we will ask for your separate agreement first and name the lender. [TO BE CONFIRMED by the business.]",
      "Retention and deletion: [RETENTION PERIOD TO BE DECIDED by the business and approved by legal.] You can ask us to delete your enquiry at any time.",
      "Contact: to ask about or delete your information, use the contact page. [COMPANY LEGAL NAME AND GRIEVANCE/PRIVACY CONTACT TO BE ADDED by the business.]",
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
