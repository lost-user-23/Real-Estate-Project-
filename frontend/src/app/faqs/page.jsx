import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Container } from "@/components/ui/Container";

export const metadata = {
  title: "FAQs",
  description: "Answers to common questions about searching, saving, and posting properties on HomeNest.",
};

const GROUPS = [
  {
    id: "searching",
    title: "Searching",
    items: [
      {
        q: "Do I need an account to search?",
        a: "No. Browsing and searching listings is open to everyone. You'll only be asked to log in when you save a property, view a contact number, or post a listing.",
      },
      {
        q: "Why is the search button disabled?",
        a: "A location is required before you can search. Pick a city or locality from the suggestions, then the button becomes active.",
      },
    ],
  },
  {
    id: "saving",
    title: "Saving properties",
    items: [
      {
        q: "Why do I need to log in to save a listing?",
        a: "Saved properties are tied to your account so they're there the next time you visit, from any device.",
      },
      {
        q: "Where do my saved properties go?",
        a: "Once logged in, save icon taps are stored against your account. This demo build keeps them in memory for the session.",
      },
    ],
  },
  {
    id: "posting",
    title: "Posting a listing",
    items: [
      {
        q: "What happens after I submit a listing?",
        a: "In the live product, it goes to admin review — details, photos, and address are checked before it's marked Verified and published.",
      },
      {
        q: "Can I edit a listing after posting?",
        a: "That flow isn't part of this build yet. For now, post a new listing if something needs to change.",
      },
    ],
  },
];

export default function FaqsPage() {
  return (
    <PageShell>
      <PageHeader eyebrow="Support" title="Frequently asked questions" />
      <div className="py-10 sm:py-14">
        <Container className="max-w-3xl">
          <div className="flex flex-col gap-10">
            {GROUPS.map((group) => (
              <section key={group.id} id={group.id}>
                <h2 className="text-lg font-semibold">{group.title}</h2>
                <div className="mt-4 flex flex-col gap-4">
                  {group.items.map((item) => (
                    <div key={item.q} className="rounded-2xl border border-border bg-surface p-4">
                      <p className="font-medium">{item.q}</p>
                      <p className="mt-1 text-sm text-text-muted">{item.a}</p>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </Container>
      </div>
    </PageShell>
  );
}
