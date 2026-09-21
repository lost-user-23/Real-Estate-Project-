import { Container } from "@/components/ui/Container";

export function Section({ id, title, subtitle, action, children, tone = "bg" }) {
  return (
    <section
      id={id}
      className={`py-12 sm:py-16 ${tone === "surface" ? "bg-surface" : "bg-bg"}`}
      aria-labelledby={id ? `${id}-heading` : undefined}
    >
      <Container>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id={id ? `${id}-heading` : undefined} className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {title}
            </h2>
            {subtitle ? <p className="mt-2 max-w-2xl text-text-muted">{subtitle}</p> : null}
          </div>
          {action}
        </div>
        {children}
      </Container>
    </section>
  );
}
