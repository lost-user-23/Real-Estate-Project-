import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/Container";
import { PropertyValueCalculator } from "@/components/tools/PropertyValueCalculator";

export const metadata = {
  title: "Property Value Calculator",
  description:
    "Get an indicative property value range by city, property type, built-up area, and age. Free estimate, no sign-up required.",
};

export default function PropertyValueCalculatorPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Tools"
        title="Property value estimator"
        description="Get a quick, indicative value range for a property. This is an estimate based on average locality rates, not a formal valuation."
      />
      <div className="py-10 sm:py-14">
        <Container className="max-w-4xl">
          <PropertyValueCalculator />
        </Container>
      </div>
    </PageShell>
  );
}
