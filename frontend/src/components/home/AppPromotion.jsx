import { Container } from "@/components/ui/Container";

export function AppPromotion() {
  return (
    <section className="bg-primary py-12 text-white sm:py-16">
      <Container>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">A HomeNest app is on the way</h2>
            <p className="mt-2 max-w-xl text-white/85">
              We&apos;re building a mobile app so you can search and manage listings on the go. For now, this site
              works just as well from your phone&apos;s browser.
            </p>
          </div>
        </div>
      </Container>
    </section>
  );
}
