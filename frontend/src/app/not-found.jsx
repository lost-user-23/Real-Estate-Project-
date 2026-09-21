import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";

export const metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <PageShell>
      <div className="flex flex-1 items-center py-20">
        <Container className="max-w-xl text-center">
          <p className="text-sm font-semibold text-primary">404</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">We couldn&apos;t find that page</h1>
          <p className="mt-3 text-text-muted">
            The listing, project, or page you&apos;re looking for may have been removed or the link may be
            incorrect.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
          >
            Back to home
          </Link>
        </Container>
      </div>
    </PageShell>
  );
}
