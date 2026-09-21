import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/Container";

export const metadata = {
  title: "Careers",
  description: "HomeNest is pre-launch — no open roles yet, but we're happy to hear from you.",
};

export default function CareersPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="Careers" title="Join us, eventually" />
      <div className="py-10 sm:py-14">
        <Container className="max-w-2xl">
          <p className="text-text-muted">
            HomeNest is still pre-launch, so we don&apos;t have open roles listed right now. Once we do, they&apos;ll
            show up here.
          </p>
          <p className="mt-4 text-text-muted">
            If you&apos;re interested in working with us when that changes, reach out at{" "}
            <a href="mailto:careers@homenest.example" className="text-primary hover:underline">
              careers@homenest.example
            </a>
            .
          </p>
        </Container>
      </div>
    </PageShell>
  );
}
