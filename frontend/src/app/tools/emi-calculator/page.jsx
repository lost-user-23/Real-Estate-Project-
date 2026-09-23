import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/Container";
import { EmiCalculator } from "@/components/tools/EmiCalculator";

export const metadata = {
  title: "EMI Calculator",
  description:
    "Calculate your monthly home loan EMI instantly from the loan amount, interest rate, and tenure. Free and no sign-up required.",
};

export default function EmiCalculatorPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Tools"
        title="EMI calculator"
        description="Estimate your monthly home loan instalment. Adjust the loan amount, interest rate, and tenure to see how each affects your EMI."
      />
      <div className="py-10 sm:py-14">
        <Container className="max-w-4xl">
          <EmiCalculator />
        </Container>
      </div>
    </PageShell>
  );
}
