import { Suspense } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/Container";
import { PostPropertyForm } from "@/components/post-property/PostPropertyForm";

export const metadata = {
  title: "Post Property",
  description: "List your property and reach interested buyers and tenants.",
};

export default function PostPropertyPage() {
  return (
    <PageShell>
      <PageHeader
        eyebrow="Sell or rent out"
        title="Post your property"
        description="Give us the details below. Every listing is reviewed before it goes live."
      />
      <div className="py-8 sm:py-12">
        <Container className="max-w-2xl">
          <Suspense fallback={null}>
            <PostPropertyForm />
          </Suspense>
        </Container>
      </div>
    </PageShell>
  );
}
