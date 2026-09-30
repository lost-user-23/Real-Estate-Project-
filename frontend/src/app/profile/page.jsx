import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/Container";
import { ProfileContent } from "@/components/account/ProfileContent";

export const metadata = {
  title: "Your profile",
  robots: { index: false },
};

export default function ProfilePage() {
  return (
    <PageShell>
      <PageHeader eyebrow="Account" title="Your profile" description="Manage your details, sign-in and listings." />
      <div className="py-8 sm:py-12">
        <Container className="max-w-2xl">
          <ProfileContent />
        </Container>
      </div>
    </PageShell>
  );
}
