import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import { formatArea, formatPrice } from "@/lib/format";
import { PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";
import { PageShell } from "@/components/layout/PageShell";
import { Container } from "@/components/ui/Container";
import { ContactOwnerCard } from "@/components/property/ContactOwnerCard";
import { PropertyGallery } from "@/components/property/PropertyGallery";
import { SaveButton } from "@/components/property/SaveButton";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/site";
import { CheckBadgeIcon, MapPinIcon, StarIcon } from "@/components/icons";

const getProperty = cache(async (slug) => {
  try {
    const result = await api.get(`/api/v1/properties/${encodeURIComponent(slug)}`, { auth: false });
    return result?.property ?? null;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
});

const META_DESCRIPTION_MAX = 160;

function titleCase(value) {
  return value.replace(/(^|-)([a-z])/g, (_, sep, ch) => (sep ? "-" : "") + ch.toUpperCase());
}

function floorLabel(floor) {
  if (floor === 0) return "Ground";
  if (floor < 0) return "Basement";
  return String(floor);
}

// Optional details; a row only appears when the listing has a value for it.
function buildDetailRows(property) {
  const has = (value) => value !== null && value !== undefined && value !== "";
  return [
    has(property.bathrooms) ? ["Bathrooms", property.bathrooms] : null,
    has(property.balconies) ? ["Balconies", property.balconies] : null,
    has(property.furnished) ? ["Furnishing", titleCase(property.furnished)] : null,
    has(property.floor) ? ["Floor", floorLabel(property.floor)] : null,
    has(property.facing) ? ["Facing", titleCase(property.facing)] : null,
    has(property.ownership) ? ["Ownership", property.ownership] : null,
    has(property.yearOfConstruction) ? ["Year built", property.yearOfConstruction] : null,
    property.isLuxury ? ["Category", "Luxury"] : null,
  ].filter(Boolean);
}

function buildDescription(property, location) {
  const summary = `${property.title} in ${location}. ${formatArea(property.areaSqft)}, ${formatPrice(property.priceInRupees)}${property.intent === "rent" ? "/mo" : ""}.`;
  const detail = property.description?.trim();
  if (!detail) return summary;
  const combined = `${summary} ${detail}`;
  return combined.length > META_DESCRIPTION_MAX ? `${combined.slice(0, META_DESCRIPTION_MAX - 1).trimEnd()}…` : combined;
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  let property = null;
  try {
    property = await getProperty(slug);
  } catch {
    // Backend unreachable: fall back to the site defaults rather than failing the head.
    return {};
  }
  if (!property) return { title: "Property not found", robots: { index: false } };

  const location = property.locality ? `${property.locality}, ${property.city}` : property.city;
  const description = buildDescription(property, location);
  const url = `${SITE_URL}/property/${encodeURIComponent(property.slug || slug)}`;
  const photo = property.images?.find((image) => image.url);
  const images = photo ? [{ url: photo.url, alt: `${property.title}, photo 1` }] : [DEFAULT_OG_IMAGE];

  return {
    title: property.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: property.title,
      description,
      url,
      siteName: SITE_NAME,
      type: "website",
      images,
    },
    twitter: {
      card: photo ? "summary_large_image" : "summary",
      title: property.title,
      description,
      images: images.map((image) => image.url),
    },
  };
}

export default async function PropertyDetailPage({ params }) {
  const { slug } = await params;
  const property = await getProperty(slug);
  if (!property) notFound();

  const propertyId = String(property._id);
  const galleryImages = (property.images ?? []).filter((image) => image.url);
  const location = property.locality ? `${property.locality}, ${property.city}` : property.city;
  const detailRows = buildDetailRows(property);
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
              <PropertyGallery
                title={property.title}
                images={galleryImages}
                badges={
                  <>
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
                  </>
                }
              />

              <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{property.title}</h1>
                  <p className="mt-1 flex items-center gap-1 text-text-muted">
                    <MapPinIcon className="h-4 w-4 shrink-0" />
                    {location}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <SaveButton propertyId={propertyId} />
                  <Link
                    href={`/report?listing=${encodeURIComponent(`/property/${property.slug || slug}`)}&propertyId=${encodeURIComponent(propertyId)}`}
                    className="text-sm text-text-muted underline underline-offset-2 hover:text-primary"
                  >
                    Report this listing
                  </Link>
                </div>
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

              {detailRows.length ? (
                <div className="mt-6">
                  <h2 className="text-lg font-semibold">Property details</h2>
                  <dl className="mt-3 grid grid-cols-2 gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-4">
                    {detailRows.map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-text-muted">{label}</dt>
                        <dd className="mt-1 font-medium">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}

              {property.amenities?.length ? (
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
                  {property.description || `No description provided for this listing. ${typeLabel} in ${location}, covering ${formatArea(property.areaSqft)}.`}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <ContactOwnerCard propertyId={propertyId} />
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
