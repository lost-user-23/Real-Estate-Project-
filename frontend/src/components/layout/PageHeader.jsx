import { Container } from "@/components/ui/Container";

export function PageHeader({ eyebrow, title, description }) {
  return (
    <div className="border-b border-border bg-surface py-10 sm:py-14">
      <Container>
        {eyebrow ? <p className="text-sm font-semibold text-primary">{eyebrow}</p> : null}
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {description ? <p className="mt-3 max-w-2xl text-text-muted">{description}</p> : null}
      </Container>
    </div>
  );
}
