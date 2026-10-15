"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLoginPrompt } from "@/lib/login-prompt-context";
import { api } from "@/lib/api";
import { AmenityPicker } from "@/components/AmenityPicker";
import { formatPrice } from "@/lib/format";
import { PROPERTY_TYPE_LABELS, PROPERTY_TYPE_OPTIONS_BY_INTENT } from "@/lib/propertyTypes";
import { descriptionError, fieldErrorsFromApiError, localityError, phoneError, titleError } from "@/lib/propertyValidation";

const MIN_PHOTOS = 5;

const INITIAL_FORM = {
  intent: "buy",
  title: "",
  propertyType: "apartment",
  city: "",
  locality: "",
  bhk: "",
  bathrooms: "",
  balconies: "",
  floor: "",
  furnished: "",
  facing: "",
  ownership: "",
  yearOfConstruction: "",
  isLuxury: false,
  areaSqft: "",
  price: "",
  amenities: [],
  description: "",
  contactNumber: "",
  images: [],
};

export function PostPropertyForm() {
  const searchParams = useSearchParams();
  const { isLoggedIn } = useAuth();
  const { requestLogin } = useLoginPrompt();
  const [form, setForm] = useState(() => ({
    ...INITIAL_FORM,
    intent: searchParams.get("intent") === "rent" ? "rent" : INITIAL_FORM.intent,
    city: searchParams.get("city") ?? "",
    propertyType: searchParams.get("propertyType") ?? INITIAL_FORM.propertyType,
  }));
  const [submitted, setSubmitted] = useState(null);
  const [imageError, setImageError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});

  const update = (patch) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setServerErrors({});
  };

  const errors = {
    title: titleError(form.title),
    description: descriptionError(form.description),
    locality: localityError(form.locality),
    // Optional: a blank number is left out of the payload instead of validated.
    contactNumber: form.contactNumber.trim() ? phoneError(form.contactNumber) : null,
  };
  const touch = (field) => setTouched((prev) => ({ ...prev, [field]: true }));
  const fieldError = (field) => ((attempted || touched[field]) && errors[field]) || serverErrors[field] || null;

  const hasMinimumImages = form.images.length >= MIN_PHOTOS;

  const handleImageUpload = (event) => {
    const uploadedFiles = Array.from(event.target.files || []);
    if (!uploadedFiles.length) return;

    const validImages = uploadedFiles.filter((file) => file.type.startsWith("image/"));
    if (!validImages.length) {
      setImageError("Please upload valid image files only.");
      event.target.value = "";
      return;
    }

    setForm((prev) => ({
      ...prev,
      images: [
        ...prev.images,
        ...validImages.map((file) => ({
          id: `${file.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: file.name,
            file,
          url: URL.createObjectURL(file),
        })),
      ],
    }));
    setImageError("");
    event.target.value = "";
  };

  const removeImage = (imageId) => {
    const removedImage = form.images.find((image) => image.id === imageId);
    if (removedImage?.url.startsWith("blob:")) URL.revokeObjectURL(removedImage.url);
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((image) => image.id !== imageId),
    }));
  };

  const submitListing = async () => {
    setSubmitError("");
    setServerErrors({});
    setIsSubmitting(true);
    try {
      const uploadedImages = await Promise.all(
        form.images.map(async (image, index) => {
          const uploadData = new FormData();
          uploadData.append("image", image.file);
          const uploaded = await api.post("/api/v1/uploads/image", uploadData);
          return { url: uploaded.url, publicId: uploaded.publicId, alt: image.name, displayOrder: index };
        })
      );

      const payload = {
        title: form.title.trim(),
        intent: form.intent,
        propertyType: form.propertyType,
        city: form.city.trim(),
        locality: form.locality.trim(),
        bhk: form.bhk === "" ? null : Number(form.bhk),
        bathrooms: form.bathrooms === "" ? null : Number(form.bathrooms),
        balconies: form.balconies === "" ? null : Number(form.balconies),
        floor: form.floor === "" ? null : Number(form.floor),
        furnished: form.furnished || null,
        facing: form.facing || null,
        ownership: form.ownership.trim() || null,
        yearOfConstruction: form.yearOfConstruction === "" ? null : Number(form.yearOfConstruction),
        isLuxury: form.isLuxury,
        areaSqft: Number(form.areaSqft),
        priceInRupees: Number(form.price),
        amenities: form.amenities,
        description: form.description.trim(),
        ...(form.contactNumber.trim() ? { contactNumber: form.contactNumber.trim() } : {}),
        images: uploadedImages,
      };
      const result = await api.post("/api/v1/properties", payload);
      setSubmitted(result.property);
    } catch (error) {
      const fieldErrors = fieldErrorsFromApiError(error);
      setServerErrors(fieldErrors);
      // Field-level messages show next to their inputs; keep the banner for anything else.
      if (Object.keys(fieldErrors).length === 0) {
        setSubmitError(error.message || "Your listing could not be submitted. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setAttempted(true);
    if (Object.values(errors).some(Boolean)) return;
    if (!hasMinimumImages) {
      setImageError(`Please upload at least ${MIN_PHOTOS} photos before submitting your property listing.`);
      return;
    }

    if (!isLoggedIn) {
      // login establishes the shared cookie-backed session before this runs
      requestLogin(() => submitListing());
      return;
    }
    submitListing();
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-lg font-semibold">Listing submitted for review</p>
        <p className="mt-2 text-sm text-text-muted">
          Your listing has been saved as a draft. It will need admin approval before appearing on the site.
        </p>
        <dl className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-x-4 gap-y-2 text-left text-sm">
          <dt className="text-text-muted">Listing</dt>
          <dd>{submitted.title}</dd>
          <dt className="text-text-muted">Type</dt>
          <dd>
            {submitted.intent === "rent" ? "For rent" : "For sale"} &middot; {PROPERTY_TYPE_LABELS[submitted.propertyType]}
          </dd>
          <dt className="text-text-muted">Location</dt>
          <dd>
            {submitted.locality ? `${submitted.locality}, ` : ""}
            {submitted.city || "—"}
          </dd>
          <dt className="text-text-muted">Price</dt>
          <dd>{submitted.priceInRupees != null ? formatPrice(submitted.priceInRupees) : "—"}</dd>
          <dt className="text-text-muted">Area</dt>
          <dd>{submitted.areaSqft ? `${submitted.areaSqft} sq.ft` : "—"}</dd>
          <dt className="text-text-muted">Photos</dt>
          <dd>{submitted.images?.length ? `${submitted.images.length} uploaded` : "None uploaded"}</dd>
        </dl>
        <button
          type="button"
          onClick={() => {
            setSubmitted(null);
            setForm({ ...INITIAL_FORM, city: searchParams.get("city") ?? "", propertyType: searchParams.get("propertyType") ?? INITIAL_FORM.propertyType });
          }}
          className="mt-6 inline-flex items-center justify-center rounded-full border border-primary px-5 py-2 text-sm font-semibold text-primary hover:bg-primary hover:text-white"
        >
          Post another
        </button>
      </div>
    );
  }

  const propertyTypeOptions = PROPERTY_TYPE_OPTIONS_BY_INTENT[form.intent];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {!isLoggedIn ? (
        <div className="rounded-2xl border border-accent-dark/30 bg-accent/15 px-4 py-3 text-sm text-accent-ink">
          You can fill this in, but you&apos;ll need to log in before it submits.
        </div>
      ) : null}

      {submitError ? <p role="alert" className="text-sm text-danger">{submitError}</p> : null}

      <p className="-mb-3 text-sm font-medium">You&apos;re looking to&hellip;</p>
      <div role="radiogroup" aria-label="Listing intent" className="flex gap-2">
        {["buy", "rent"].map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={form.intent === option}
            onClick={() => update({ intent: option })}
            className={`rounded-lg px-6 py-2 text-sm font-semibold transition-colors ${
              form.intent === option ? "bg-primary/10 text-primary border border-primary/30" : "bg-surface text-text border border-border"
            }`}
          >
            {option === "rent" ? "Rent" : "Sell"}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Property photos</p>
            <p className="text-xs text-text-muted">{`Upload at least ${MIN_PHOTOS} clear images of the property.`}</p>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark">
            Upload photos
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
          </label>
        </div>

        {imageError ? <p className="mt-3 text-sm text-danger">{imageError}</p> : null}
        {!hasMinimumImages && form.images.length > 0 ? (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {`You've added ${form.images.length} photo${form.images.length === 1 ? "" : "s"}. Please upload at least ${MIN_PHOTOS} photos.`}
          </p>
        ) : null}
        {!hasMinimumImages ? (
          <p className="mt-3 text-xs text-text-muted">{`Minimum ${MIN_PHOTOS} photos required to submit this listing.`}</p>
        ) : null}

        {form.images.length ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {form.images.map((image) => (
              <div key={image.id} className="relative overflow-hidden rounded-xl border border-border bg-bg">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, not a remote image next/image could optimise */}
                <img src={image.url} alt={image.name} className="h-28 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(image.id)}
                  className="absolute right-2 top-2 rounded-full bg-surface/90 px-2 py-1 text-[10px] font-medium text-text"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-bg px-4 py-6 text-center text-sm text-text-muted">
            No photos uploaded yet.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Listing title" required>
          <input
            type="text"
            required
            maxLength={200}
            value={form.title}
            onChange={(e) => update({ title: e.target.value })}
            onBlur={() => touch("title")}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          {fieldError("title") ? <p role="alert" className="mt-1 text-xs text-danger">{fieldError("title")}</p> : null}
        </Field>

        <Field label="Property type">
          <select
            value={form.propertyType}
            onChange={(e) => update({ propertyType: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            {propertyTypeOptions.map((type) => (
              <option key={type} value={type}>
                {PROPERTY_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="BHK (leave blank for plots/commercial)">
          <input
            type="number"
            min={0}
            value={form.bhk}
            onChange={(e) => update({ bhk: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>

        <Field label="Bathrooms">
          <input
            type="number"
            min={0}
            value={form.bathrooms}
            onChange={(e) => update({ bathrooms: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>

        <Field label="Balconies">
          <input
            type="number"
            min={0}
            value={form.balconies}
            onChange={(e) => update({ balconies: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>

        <Field label="Floor">
          <input
            type="number"
            min={-1}
            value={form.floor}
            onChange={(e) => update({ floor: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>

        <Field label="Furnishing">
          <select
            value={form.furnished}
            onChange={(e) => update({ furnished: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            <option value="">Not specified</option>
            <option value="furnished">Furnished</option>
            <option value="semi-furnished">Semi-furnished</option>
            <option value="unfurnished">Unfurnished</option>
          </select>
        </Field>

        <Field label="Facing">
          <select
            value={form.facing}
            onChange={(e) => update({ facing: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          >
            <option value="">Not specified</option>
            <option value="north">North</option>
            <option value="south">South</option>
            <option value="east">East</option>
            <option value="west">West</option>
            <option value="north-east">North-East</option>
            <option value="north-west">North-West</option>
            <option value="south-east">South-East</option>
            <option value="south-west">South-West</option>
          </select>
        </Field>

        <Field label="Ownership (e.g. Freehold)">
          <input
            type="text"
            value={form.ownership}
            onChange={(e) => update({ ownership: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>

        <Field label="Year of construction">
          <input
            type="number"
            min={1800}
            value={form.yearOfConstruction}
            onChange={(e) => update({ yearOfConstruction: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>

        <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
          <input
            type="checkbox"
            checked={form.isLuxury}
            onChange={(e) => update({ isLuxury: e.target.checked })}
          />
          Luxury property
        </label>

        <Field label="City" required>
          <input
            type="text"
            required
            value={form.city}
            onChange={(e) => update({ city: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>

        <Field label="Locality">
          <input
            type="text"
            value={form.locality}
            onChange={(e) => update({ locality: e.target.value })}
            onBlur={() => touch("locality")}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          {fieldError("locality") ? <p role="alert" className="mt-1 text-xs text-danger">{fieldError("locality")}</p> : null}
        </Field>

        <Field label="Area (sq.ft)" required>
          <input
            type="number"
            min={1}
            required
            value={form.areaSqft}
            onChange={(e) => update({ areaSqft: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>

        <Field label={form.intent === "rent" ? "Monthly rent (₹)" : "Price (₹)"} required>
          <input
            type="number"
            min={1}
            required
            value={form.price}
            onChange={(e) => update({ price: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>

        <Field label="Contact number">
          <input
            type="tel"
            value={form.contactNumber}
            onChange={(e) => update({ contactNumber: e.target.value })}
            onBlur={() => touch("contactNumber")}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
          {fieldError("contactNumber") ? <p role="alert" className="mt-1 text-xs text-danger">{fieldError("contactNumber")}</p> : null}
        </Field>
      </div>

      <AmenityPicker value={form.amenities} onChange={(amenities) => update({ amenities })} />

      <Field label="Description">
        <textarea
          rows={4}
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          onBlur={() => touch("description")}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
        {fieldError("description") ? <p role="alert" className="mt-1 text-xs text-danger">{fieldError("description")}</p> : null}
      </Field>

      <button
        type="submit"
        disabled={isSubmitting}
        className={`self-start rounded-full px-6 py-2.5 text-sm font-semibold transition-colors ${
          !isSubmitting
            ? "bg-primary text-white hover:bg-primary-dark"
            : "cursor-not-allowed bg-border text-text-muted"
        }`}
      >
        {isSubmitting ? "Uploading photos and submitting…" : isLoggedIn ? "Submit listing" : "Log in to submit"}
      </button>
    </form>
  );
}

function Field({ label, required = false, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-xs font-medium text-text-muted">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
