import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_PROPERTIES } from "@/lib/mockData";
import { formatArea, formatPrice } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { ContactOwnerCard } from "@/components/property/ContactOwnerCard";
import { SaveButton } from "@/components/property/SaveButton";
import { CheckBadgeIcon, MapPinIcon, StarIcon } from "@/components/icons";

function getProperty(slug) {
  return MOCK_PROPERTIES.find((p) => p.slug === slug && p.status === "published");
}

export function generateStaticParams() {
  return MOCK_PROPERTIES.filter((p) => p.status === "published").map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const property = getProperty(slug);
  if (!property) return { title: "Property not found" };
  return {
    title: property.title,
    description: `${property.title} in ${property.locality}, ${property.city}. ${formatArea(property.areaSqft)}, ${formatPrice(property.priceInRupees)}${property.intent === "rent" ? "/mo" : ""}.`,
  };
}

export default async function PropertyDetailPage({ params }) {
  const { slug } = await params;
  const property = getProperty(slug);
  if (!property) notFound();

  const typeLabel = property.bhk
    ? `${property.bhk} BHK ${PROPERTY_TYPE_LABELS[property.propertyType]}`
    : PROPERTY_TYPE_LABELS[property.propertyType];

  return (
    <PageShell>
      <div className="py-8 sm:py-12">
        <Container>
          <nav aria-label="Breadcrumb" className="text-sm text-text-muted">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>{" "}
            / <Link href={`/search?city=${encodeURIComponent(property.city)}`} className="hover:text-primary">
              {property.city}
            </Link>{" "}
            / <span className="text-text">{property.title}</span>
          </nav>

          <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl bg-bg sm:aspect-16/9">
                <Image
                  src={property.image.src}
                  alt={property.image.alt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 66vw"
                  priority
                  className="object-cover"
                />
                <div className="absolute left-3 top-3 flex items-center gap-1.5">
                  {property.featured ? (
                    <span className="flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-ink">
                      <StarIcon className="h-3.5 w-3.5" />
                      Featured
                    </span>
                  ) : null}
                  {property.verified ? (
                    <span className="flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-white">
                      <CheckBadgeIcon className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{property.title}</h1>
                  <p className="mt-1 flex items-center gap-1 text-text-muted">
                    <MapPinIcon className="h-4 w-4 shrink-0" />
                    {property.locality}, {property.city}
                  </p>
                </div>
                <SaveButton propertyId={property.id} />
              </div>

              <p className="mt-4 text-2xl font-semibold">
                {formatPrice(property.priceInRupees)}
                {property.intent === "rent" ? <span className="text-base font-normal text-text-muted">/mo</span> : null}
              </p>

              <dl className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-4">
                <div>
                  <dt className="text-xs text-text-muted">Type</dt>
                  <dd className="mt-1 font-medium">{typeLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Area</dt>
                  <dd className="mt-1 font-medium">{formatArea(property.areaSqft)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Listing type</dt>
                  <dd className="mt-1 font-medium">{property.intent === "rent" ? "For rent" : "For sale"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-muted">Status</dt>
                  <dd className="mt-1 font-medium">{property.verified ? "Verified" : "Under review"}</dd>
                </div>
              </dl>

              {property.amenities.length ? (
                <div className="mt-6">
                  <h2 className="text-lg font-semibold">Amenities</h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {property.amenities.map((amenity) => (
                      <li key={amenity} className="rounded-full bg-bg px-3 py-1.5 text-sm text-text-muted">
                        {amenity}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-6">
                <h2 className="text-lg font-semibold">About this property</h2>
                <p className="mt-2 text-text-muted">
                  This {typeLabel.toLowerCase()} in {property.locality}, {property.city} spans{" "}
                  {formatArea(property.areaSqft)}
                  {property.verified
                    ? ". Details, photos, and the address have passed our admin review checklist."
                    : ". This listing is awaiting admin review."}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <ContactOwnerCard propertyId={property.id} />
              <p className="text-xs text-text-muted">
                Verified confirms the listing passed our review checklist. It does not confirm ownership or title.
              </p>
            </div>
          </div>
        </Container>
      </div>
    </PageShell>
  );
}
