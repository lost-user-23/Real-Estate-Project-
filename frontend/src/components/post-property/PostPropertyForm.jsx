"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLoginPrompt } from "@/lib/login-prompt-context";
import { AMENITY_PRIORITY } from "@/lib/amenities";
import { PROPERTY_TYPE_LABELS, PROPERTY_TYPE_OPTIONS_BY_INTENT } from "@/lib/propertyTypes";

const INITIAL_FORM = {
  intent: "buy",
  propertyType: "apartment",
  city: "",
  locality: "",
  bhk: "",
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
    city: searchParams.get("city") ?? "",
    propertyType: searchParams.get("propertyType") ?? INITIAL_FORM.propertyType,
  }));
  const [submitted, setSubmitted] = useState(null);
  const [imageError, setImageError] = useState("");

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const hasMinimumImages = form.images.length >= 5;

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
          url: URL.createObjectURL(file),
        })),
      ],
    }));
    setImageError("");
    event.target.value = "";
  };

  const removeImage = (imageId) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((image) => image.id !== imageId),
    }));
  };

  const toggleAmenity = (amenity) => {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!hasMinimumImages) {
      setImageError("Please upload at least 5 photos before submitting your property listing.");
      return;
    }

    if (!isLoggedIn) {
      requestLogin();
      return;
    }
    setSubmitted(form);
  };

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-lg font-semibold">Listing details captured</p>
        <p className="mt-2 text-sm text-text-muted">
          There&apos;s no backend connected yet, so nothing was actually saved or published. In the live product,
          this listing would now go to admin review before appearing on the site.
        </p>
        <dl className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-x-4 gap-y-2 text-left text-sm">
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
          <dd>{submitted.price ? `₹${Number(submitted.price).toLocaleString("en-IN")}` : "—"}</dd>
          <dt className="text-text-muted">Area</dt>
          <dd>{submitted.areaSqft ? `${submitted.areaSqft} sq.ft` : "—"}</dd>
          <dt className="text-text-muted">Photos</dt>
          <dd>{submitted.images?.length ? `${submitted.images.length} uploaded` : "None uploaded"}</dd>
        </dl>
        <button
          type="button"
          onClick={() => setSubmitted(null)}
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

      <div role="radiogroup" aria-label="Listing intent" className="flex gap-2">
        {["buy", "rent"].map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={form.intent === option}
            onClick={() => update({ intent: option })}
            className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
              form.intent === option ? "bg-primary text-white" : "bg-surface text-text-muted border border-border"
            }`}
          >
            {option === "rent" ? "List for rent" : "List for sale"}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Property photos</p>
            <p className="text-xs text-text-muted">Upload at least 5 clear images of the property.</p>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-dark">
            Upload photos
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
          </label>
        </div>

        {imageError ? <p className="mt-3 text-sm text-danger">{imageError}</p> : null}
        {!hasMinimumImages ? (
          <p className="mt-3 text-xs text-text-muted">Minimum 5 photos required to submit this listing.</p>
        ) : null}

        {form.images.length ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {form.images.map((image) => (
              <div key={image.id} className="relative overflow-hidden rounded-xl border border-border bg-bg">
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
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
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

        <Field label="Contact number" required>
          <input
            type="tel"
            required
            value={form.contactNumber}
            onChange={(e) => update({ contactNumber: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
          />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Amenities</legend>
        <div className="flex flex-wrap gap-2">
          {AMENITY_PRIORITY.map((amenity) => {
            const checked = form.amenities.includes(amenity);
            return (
              <button
                key={amenity}
                type="button"
                aria-pressed={checked}
                onClick={() => toggleAmenity(amenity)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  checked ? "border-primary bg-primary-light text-primary" : "border-border text-text-muted"
                }`}
              >
                {amenity}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Description">
        <textarea
          rows={4}
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary"
        />
      </Field>

      <button
        type="submit"
        disabled={!hasMinimumImages}
        className={`self-start rounded-full px-6 py-2.5 text-sm font-semibold transition-colors ${
          hasMinimumImages
            ? "bg-primary text-white hover:bg-primary-dark"
            : "cursor-not-allowed bg-border text-text-muted"
        }`}
      >
        {isLoggedIn ? "Submit listing" : "Log in to submit"}
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
