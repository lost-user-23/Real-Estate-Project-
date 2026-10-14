"use client";

import { useState } from "react";
import { useAdminStore } from "@/lib/admin-store";
import { useToast } from "@/lib/toast-context";
import { AmenityPicker } from "@/components/AmenityPicker";
import { PROPERTY_TYPE_LABELS, PROPERTY_TYPE_OPTIONS_BY_INTENT } from "@/lib/propertyTypes";
import { AdminField, adminFieldInputClass } from "@/components/admin/AdminField";
import { descriptionError, fieldErrorsFromApiError, localityError, phoneError, titleError } from "@/lib/propertyValidation";

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

export function AddListingForm({ onDone, item = null }) {
  const { addProperty, updateProperty } = useAdminStore();
  const { show } = useToast();
  const [form, setForm] = useState(
    item
      ? {
          title: item.title ?? "",
          intent: item.intent,
          propertyType: item.propertyType,
          bhk: item.bhk != null ? String(item.bhk) : "",
          city: item.city ?? "",
          locality: item.locality ?? "",
          areaSqft: String(item.areaSqft ?? ""),
          price: String(item.priceInRupees ?? ""),
          description: item.description ?? "",
          contactNumber: item.contactNumber ?? "",
          amenities: item.amenities ?? [],
          status: item.status,
        }
      : INITIAL
  );
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setAttempted(true);
    if (Object.values(errors).some(Boolean)) return;
    if (!item && files.length < MIN_PHOTOS) {
      setError(`Please add at least ${MIN_PHOTOS} photos.`);
      return;
    }
    setError("");
    setServerErrors({});
    setSubmitting(true);
    try {
      if (item) {
        // Text fields only: photos and status are left as they are (status has its own select in the table).
        await updateProperty(item.id, {
          title: form.title.trim(),
          intent: form.intent,
          propertyType: form.propertyType,
          bhk: form.bhk ? Number(form.bhk) : null,
          priceInRupees: Number(form.price),
          areaSqft: Number(form.areaSqft),
          city: form.city,
          locality: form.locality.trim(),
          description: form.description.trim(),
          contactNumber: form.contactNumber.trim() || undefined,
          amenities: form.amenities,
        });
        onDone();
        return;
      }
      const { publishError } = await addProperty({
        title: form.title.trim(),
        intent: form.intent,
        propertyType: form.propertyType,
        bhk: form.bhk ? Number(form.bhk) : null,
        priceInRupees: Number(form.price),
        areaSqft: Number(form.areaSqft),
        city: form.city,
        locality: form.locality.trim() || undefined,
        description: form.description.trim(),
        contactNumber: form.contactNumber.trim() || undefined,
        amenities: form.amenities,
        status: form.status,
        files,
      });
      if (publishError) {
        show(`The listing was saved as a draft, but publishing it failed: ${publishError}. Publish it from the listings table.`, {
          error: true,
        });
      }
      onDone();
    } catch (e) {
      const fieldErrors = fieldErrorsFromApiError(e);
      setServerErrors(fieldErrors);
      // Field-level messages show next to their inputs; keep the banner for anything else.
      setError(Object.keys(fieldErrors).length > 0 ? "" : e?.message || `Could not ${item ? "save" : "create"} the listing. Please try again.`);
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
          onBlur={() => touch("title")}
          className={adminFieldInputClass}
        />
        {fieldError("title") ? <p role="alert" className="mt-1 text-xs text-danger">{fieldError("title")}</p> : null}
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
            onBlur={() => touch("locality")}
            className={adminFieldInputClass}
          />
          {fieldError("locality") ? <p role="alert" className="mt-1 text-xs text-danger">{fieldError("locality")}</p> : null}
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
        {item ? null : (
          <AdminField label="Status">
            <select value={form.status} onChange={(e) => update({ status: e.target.value })} className={adminFieldInputClass}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </AdminField>
        )}
      </div>

      <AdminField label="Description">
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => update({ description: e.target.value })}
          onBlur={() => touch("description")}
          className={adminFieldInputClass}
        />
        {fieldError("description") ? <p role="alert" className="mt-1 text-xs text-danger">{fieldError("description")}</p> : null}
      </AdminField>
      <AdminField label="Contact number">
        <input
          value={form.contactNumber}
          onChange={(e) => update({ contactNumber: e.target.value })}
          onBlur={() => touch("contactNumber")}
          className={adminFieldInputClass}
        />
        {fieldError("contactNumber") ? <p role="alert" className="mt-1 text-xs text-danger">{fieldError("contactNumber")}</p> : null}
      </AdminField>
      {item ? null : (
        <AdminField label={`Photos (${files.length} selected, minimum ${MIN_PHOTOS})`} required>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/")))}
            className={adminFieldInputClass}
          />
        </AdminField>
      )}

      <AmenityPicker value={form.amenities} onChange={(amenities) => update({ amenities })} />

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
      >
        {item ? (submitting ? "Saving…" : "Save changes") : submitting ? "Uploading and saving…" : "Add listing"}
      </button>
    </form>
  );
}
