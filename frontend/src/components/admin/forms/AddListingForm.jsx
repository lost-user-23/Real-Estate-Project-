"use client";

import { useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { AMENITY_PRIORITY } from "@/lib/amenities";
import { PROPERTY_TYPE_LABELS, PROPERTY_TYPE_OPTIONS_BY_INTENT } from "@/lib/propertyTypes";
import { AdminField, adminFieldInputClass } from "@/components/admin/AdminField";

const INITIAL = {
  title: "",
  intent: "buy",
  propertyType: "apartment",
  bhk: "",
  city: "",
  locality: "",
  areaSqft: "",
  price: "",
  description: "",
  contactNumber: "",
  amenities: [],
  status: "draft",
};

const MIN_PHOTOS = 5;

export function AddListingForm({ onDone }) {
  const { addProperty } = useAdminStore();
  const [form, setForm] = useState(INITIAL);
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const toggleAmenity = (amenity) => {
    setForm((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (files.length < MIN_PHOTOS) {
      setError(`Please add at least ${MIN_PHOTOS} photos.`);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const { publishError } = await addProperty({
        title: form.title,
        intent: form.intent,
        propertyType: form.propertyType,
        bhk: form.bhk ? Number(form.bhk) : null,
        priceInRupees: Number(form.price),
        areaSqft: Number(form.areaSqft),
        city: form.city,
        locality: form.locality.trim() || null,
        description: form.description,
        contactNumber: form.contactNumber.trim() || undefined,
        amenities: form.amenities,
        status: form.status,
        files,
      });
      if (publishError) {
        window.alert(`The listing was saved as a draft, but publishing it failed: ${publishError}. Publish it from the listings table.`);
      }
      onDone();
    } catch (e) {
      setError(e?.message || "Could not create the listing. Please try again.");
      setSubmitting(false);
    }
  };

  const propertyTypeOptions = PROPERTY_TYPE_OPTIONS_BY_INTENT[form.intent];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <AdminField label="Title" required>
        <input
          required
          value={form.title}
          onChange={(e) => update({ title: e.target.value })}
          className={adminFieldInputClass}
        />
      </AdminField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AdminField label="Listing type">
          <select
            value={form.intent}
            onChange={(e) =>
              update({
                intent: e.target.value,
                propertyType: PROPERTY_TYPE_OPTIONS_BY_INTENT[e.target.value][0],
              })
            }
            className={adminFieldInputClass}
          >
            <option value="buy">For sale</option>
            <option value="rent">For rent</option>
          </select>
        </AdminField>
        <AdminField label="Property type">
          <select
            value={form.propertyType}
            onChange={(e) => update({ propertyType: e.target.value })}
            className={adminFieldInputClass}
          >
            {propertyTypeOptions.map((type) => (
              <option key={type} value={type}>
                {PROPERTY_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </AdminField>
        <AdminField label="BHK (optional)">
          <input
            type="number"
            min={0}
            value={form.bhk}
            onChange={(e) => update({ bhk: e.target.value })}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="Area (sq.ft)" required>
          <input
            type="number"
            min={1}
            required
            value={form.areaSqft}
            onChange={(e) => update({ areaSqft: e.target.value })}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="City" required>
          <input
            required
            value={form.city}
            onChange={(e) => update({ city: e.target.value })}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="Locality">
          <input
            value={form.locality}
            onChange={(e) => update({ locality: e.target.value })}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label={form.intent === "rent" ? "Monthly rent (₹)" : "Price (₹)"} required>
          <input
            type="number"
            min={1}
            required
            value={form.price}
            onChange={(e) => update({ price: e.target.value })}
            className={adminFieldInputClass}
          />
        </AdminField>
        <AdminField label="Status">
          <select value={form.status} onChange={(e) => update({ status: e.target.value })} className={adminFieldInputClass}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </AdminField>
      </div>

      <AdminField label="Description">
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          className={adminFieldInputClass}
        />
      </AdminField>
      <AdminField label="Contact number">
        <input
          value={form.contactNumber}
          onChange={(e) => update({ contactNumber: e.target.value })}
          className={adminFieldInputClass}
        />
      </AdminField>
      <AdminField label={`Photos (${files.length} selected, minimum ${MIN_PHOTOS})`} required>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/")))}
          className={adminFieldInputClass}
        />
      </AdminField>

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

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? "Uploading and saving…" : "Add listing"}
      </button>
    </form>
  );
}
