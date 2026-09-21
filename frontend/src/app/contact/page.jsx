import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/Container";
import { ContactForm } from "@/components/contact/ContactForm";

export const metadata = {
  title: "Contact us",
  description: "Get in touch with the HomeNest team.",
};

export default function ContactPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="Get in touch" title="Contact us" />
      <div className="py-10 sm:py-14">
        <Container>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ContactForm />
            </div>
            <div className="flex flex-col gap-4 text-sm">
              <div className="rounded-2xl border border-border bg-surface p-5">
                <p className="font-semibold">Email</p>
                <a href="mailto:support@homenest.example" className="mt-1 block text-primary hover:underline">
                  support@homenest.example
                </a>
              </div>
              <div className="rounded-2xl border border-border bg-surface p-5">
                <p className="font-semibold">Something specific?</p>
                <p className="mt-1 text-text-muted">
                  Check the{" "}
                  <a href="/faqs" className="text-primary hover:underline">
                    FAQs
                  </a>{" "}
                  or{" "}
                  <a href="/report" className="text-primary hover:underline">
                    report a listing
                  </a>{" "}
                  directly.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </div>
    </PageShell>
  );
}
