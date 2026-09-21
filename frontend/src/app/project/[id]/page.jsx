import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_PROJECTS } from "@/lib/mockData";
import { formatPrice } from "@/lib/format";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { PostPropertyButton } from "@/components/PostPropertyButton";

function getProject(id) {
  return MOCK_PROJECTS.find((p) => p.id === id && p.status === "published");
}

export function generateStaticParams() {
  return MOCK_PROJECTS.filter((p) => p.status === "published").map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) return { title: "Project not found" };
  return {
    title: project.name,
    description: `${project.name} by ${project.developer} in ${project.locality}, ${project.city}. Starting from ${formatPrice(project.startingPriceInRupees)}.`,
  };
}

export default async function ProjectDetailPage({ params }) {
  const { id } = await params;
  const project = getProject(id);
  if (!project) notFound();

  return (
    <PageShell>
      <div className="py-8 sm:py-12">
        <Container>
          <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>{" "}
            / <span className="text-text">{project.name}</span>
          </nav>

          <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-bg sm:aspect-16/9">
                <Image
                  src={project.image.src}
                  alt={project.image.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 66vw"
                  priority
                  className="object-cover"
                />
              </div>

              <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">{project.name}</h1>
              <p className="mt-1 text-text-muted">
                by {project.developer} &middot; {project.locality}, {project.city}
              </p>

              <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-text-muted">Starting price</dt>
                  <dd className="mt-1 font-medium">{formatPrice(project.startingPriceInRupees)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Possession</dt>
                  <dd className="mt-1 font-medium">{project.possessionLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Developer</dt>
                  <dd className="mt-1 font-medium">{project.developer}</dd>
                </div>
              </dl>

              <div className="mt-6">
                <h2 className="text-lg font-semibold">About this project</h2>
                <p className="mt-2 text-text-muted">
                  {project.name} is being developed by {project.developer} in {project.locality}, {project.city},
                  with possession expected {project.possessionLabel}. Unit-level floor plans and availability are
                  confirmed directly with the developer.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-2xl border border-border bg-surface p-5">
                <p className="font-semibold">Interested in this project?</p>
                <p className="mt-1 text-sm text-text-muted">
                  Reach out to list a resale unit here, or browse similar listings in {project.city}.
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <PostPropertyButton source="footer" prefill={{ city: project.city }} />
                  <Link
                    href={`/search?city=${encodeURIComponent(project.city)}`}
                    className="inline-flex items-center justify-center rounded-full border border-primary px-5 py-2.5 text-sm font-semibold text-primary hover:bg-primary hover:text-white"
                  >
                    Browse {project.city} listings
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </div>
    </PageShell>
  );
}
