import Link from "next/link";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/Container";
import { CalculatorIcon, TrendingUpIcon } from "@/components/icons";

export const metadata = {
  title: "Property tools",
  description: "Free calculators for home buyers and renters: EMI calculator and property value estimator.",
};

const TOOLS = [
  {
    href: "/tools/emi-calculator",
    icon: CalculatorIcon,
    title: "EMI calculator",
    description: "Work out your monthly home loan instalment from the loan amount, interest rate, and tenure.",
  },
  {
    href: "/tools/property-value-calculator",
    icon: TrendingUpIcon,
    title: "Property value estimator",
    description: "Get an indicative value range for a property based on city, type, area, and age.",
  },
];

export default function ToolsPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Tools"
        title="Property tools"
        description="Quick calculators to help you plan a purchase, before you start talking to a lender or a seller."
      />
      <div className="py-10 sm:py-14">
        <Container>
          <div className="grid gap-6 sm:grid-cols-2">
            {TOOLS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6 transition-shadow hover:shadow-md"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                  <tool.icon className="h-6 w-6" />
                </span>
                <p className="text-lg font-semibold group-hover:text-primary">{tool.title}</p>
                <p className="text-sm text-text-muted">{tool.description}</p>
              </Link>
            ))}
          </div>
        </Container>
      </div>
    </PageShell>
  );
}
