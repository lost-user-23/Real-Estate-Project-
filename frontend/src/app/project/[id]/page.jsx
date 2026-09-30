import { cache } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiRequest } from "@/lib/api-client";
import { formatPrice } from "@/lib/format";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { PostPropertyButton } from "@/components/PostPropertyButton";

const getProject = cache(async (id) => {
  if (!/^[a-f\d]{24}$/i.test(id)) return null;

  try {
    const result = await apiRequest(`/api/v1/projects/${encodeURIComponent(id)}`);
    return result.project ?? null;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
});

export async function generateMetadata({ params }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return { title: "Project not found" };
  const location = project.locality ? `${project.locality}, ${project.city}` : project.city;
  return {
    title: project.name,
    description: `${project.name} by ${project.developer} in ${location}. Starting from ${formatPrice(project.startingPriceInRupees)}.`,
  };
}

export default async function ProjectDetailPage({ params }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const location = project.locality ? `${project.locality}, ${project.city}` : project.city;

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
                {project.imageUrl ? (
                  <Image
                    src={project.imageUrl}
                    alt={project.imageAlt || project.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 66vw"
                    priority
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-text-muted">
                    No project photo available
                  </div>
                )}
              </div>

              <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">{project.name}</h1>
              <p className="mt-1 text-text-muted">
                by {project.developer} &middot; {location}
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
                  {project.name} is being developed by {project.developer} in {location},
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
