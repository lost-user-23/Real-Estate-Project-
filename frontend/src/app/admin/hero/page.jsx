"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useAttempt } from "@/lib/attempt";
import { useToast } from "@/lib/toast-context";
import { HERO_DECORATIONS, HERO_DECORATION_IDS } from "@/lib/heroDecorations";
import { AdminField, adminFieldInputClass } from "@/components/admin/AdminField";
import { HeroDecoration } from "@/components/home/HeroDecoration";

const MAX_SLIDES = 8;

// <input type="date"> works in local dates; events cover the whole of both days.
const toDateInput = (iso) => (iso ? new Date(iso).toLocaleDateString("en-CA") : "");
const startOfDay = (d) => new Date(`${d}T00:00:00`).toISOString();
const endOfDay = (d) => new Date(`${d}T23:59:59.999`).toISOString();

function blankEvent() {
  const today = new Date().toLocaleDateString("en-CA");
  return { id: `new-${crypto.randomUUID()}`, name: "", decoration: "diwali", start: today, end: today, enabled: true, greeting: "", badge: "", titleLead: "", titleAccent: "", subtitle: "" };
}

function fromServer(hero) {
  return {
    ...hero,
    events: hero.events.map((e) => ({ ...e, start: toDateInput(e.startsAt), end: toDateInput(e.endsAt) })),
  };
}

function toPayload(form) {
  return {
    slides: form.slides.map(({ url, publicId, alt }) => ({ url, publicId, alt })),
    badge: form.badge,
    titleLead: form.titleLead,
    titleAccent: form.titleAccent,
    subtitle: form.subtitle,
    manualDecoration: form.manualDecoration,
    events: form.events.map((e) => ({
      name: e.name,
      decoration: e.decoration,
      startsAt: startOfDay(e.start),
      endsAt: endOfDay(e.end),
      enabled: e.enabled,
      greeting: e.greeting,
      badge: e.badge,
      titleLead: e.titleLead,
      titleAccent: e.titleAccent,
      subtitle: e.subtitle,
    })),
  };
}

export default function AdminHeroPage() {
  const attempt = useAttempt();
  const { show } = useToast();
  const fileRef = useRef(null);
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoadError("");
    api
      .get("/api/v1/admin/hero")
      .then((data) => setForm(fromServer(data.hero)))
      .catch((e) => setLoadError(e?.message || "Could not load the banner settings."));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const update = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const updateEvent = (id, patch) =>
    setForm((prev) => ({ ...prev, events: prev.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
  const updateSlide = (index, patch) =>
    setForm((prev) => ({ ...prev, slides: prev.slides.map((s, i) => (i === index ? { ...s, ...patch } : s)) }));
  const moveSlide = (index, delta) =>
    setForm((prev) => {
      const next = [...prev.slides];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, slides: next };
    });

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const room = MAX_SLIDES - form.slides.length;
    if (files.length > room) show(`Only ${MAX_SLIDES} pictures are allowed; the first ${room} will be uploaded.`, { error: true });
    setUploading(true);
    for (const file of files.slice(0, Math.max(room, 0))) {
      const body = new FormData();
      body.append("image", file);
      const res = await attempt(() => api.post("/api/v1/admin/hero/image", body));
      if (!res.ok) break;
      setForm((prev) => ({ ...prev, slides: [...prev.slides, { url: res.value.url, publicId: res.value.publicId, alt: "" }] }));
    }
    setUploading(false);
  };

  const handleSave = async (event) => {
    event.preventDefault();
    for (const e of form.events) {
      if (!e.name.trim() || !e.start || !e.end) return show("Every event needs a name, a start date and an end date.", { error: true });
      if (e.end < e.start) return show(`"${e.name}": the end date is before the start date.`, { error: true });
    }
    setSaving(true);
    const res = await attempt(() => api.put("/api/v1/admin/hero", toPayload(form)));
    setSaving(false);
    if (res.ok) {
      setForm(fromServer(res.value.hero));
      show("Home banner saved.");
    }
  };

  if (loadError) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-danger px-4 py-3 text-sm text-danger">
        <span>{loadError}</span>
        <button type="button" onClick={load} className="font-medium underline">
          Retry
        </button>
      </div>
    );
  }
  if (!form) return <p className="text-sm text-text-muted">Loading…</p>;

  const manual = form.manualDecoration;

  return (
    <form onSubmit={handleSave} className="flex max-w-4xl flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Home banner</h1>
          <p className="mt-1 text-sm text-text-muted">
            The pictures, headline and festival decorations at the top of the home page. Leave a text field blank to use the default.
          </p>
        </div>
        <button
          type="submit"
          disabled={saving || uploading}
          className="shrink-0 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Background pictures</h2>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || form.slides.length >= MAX_SLIDES}
            className="rounded-full border border-border px-4 py-1.5 text-sm font-medium hover:bg-bg disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "Upload pictures"}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={handleFiles} />
        </div>
        <p className="text-xs text-text-muted">
          Up to {MAX_SLIDES} wide pictures (JPG, PNG or WebP, max 5 MB each), around 1920×1080. They rotate in this order; with none, the default pictures are used.
        </p>
        {form.slides.length === 0 ? (
          <p className="rounded-xl bg-bg px-4 py-6 text-center text-sm text-text-muted">No custom pictures — the default pictures are showing.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {form.slides.map((slide, i) => (
              <li key={slide.url} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={slide.url} alt="" className="aspect-video w-full rounded-lg object-cover" />
                <input
                  value={slide.alt}
                  onChange={(e) => updateSlide(i, { alt: e.target.value })}
                  placeholder="Describe the picture (optional)"
                  maxLength={160}
                  className={adminFieldInputClass}
                />
                <div className="flex gap-3 text-xs font-medium">
                  <button type="button" disabled={i === 0} onClick={() => moveSlide(i, -1)} className="text-primary hover:underline disabled:opacity-40">
                    Move earlier
                  </button>
                  <button type="button" disabled={i === form.slides.length - 1} onClick={() => moveSlide(i, 1)} className="text-primary hover:underline disabled:opacity-40">
                    Move later
                  </button>
                  <button type="button" onClick={() => update({ slides: form.slides.filter((_, j) => j !== i) })} className="ml-auto text-danger hover:underline">
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Title and description</h2>
        <AdminField label="Small badge above the title">
          <input value={form.badge} onChange={(e) => update({ badge: e.target.value })} maxLength={80} placeholder="Reviewed listings · Direct owner contact" className={adminFieldInputClass} />
        </AdminField>
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminField label="Title (white part)">
            <input value={form.titleLead} onChange={(e) => update({ titleLead: e.target.value })} maxLength={80} placeholder="Find the right place," className={adminFieldInputClass} />
          </AdminField>
          <AdminField label="Title (highlighted part)">
            <input value={form.titleAccent} onChange={(e) => update({ titleAccent: e.target.value })} maxLength={80} placeholder="without the noise." className={adminFieldInputClass} />
          </AdminField>
        </div>
        <AdminField label="Description">
          <textarea rows={2} value={form.subtitle} onChange={(e) => update({ subtitle: e.target.value })} maxLength={240} placeholder="Search reviewed listings for sale and rent…" className={adminFieldInputClass} />
        </AdminField>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-semibold">Festival decoration</h2>
        <AdminField label="Decoration mode">
          <select value={manual || ""} onChange={(e) => update({ manualDecoration: e.target.value || null })} className={adminFieldInputClass}>
            <option value="">Automatic — follow the scheduled events below</option>
            {HERO_DECORATION_IDS.map((id) => (
              <option key={id} value={id}>
                Always on: {HERO_DECORATIONS[id].label}
              </option>
            ))}
          </select>
        </AdminField>
        {manual ? <p className="text-xs text-text-muted">This decoration shows until you switch back to Automatic. Scheduled events are paused.</p> : null}

        <div className="flex items-center justify-between pt-2">
          <h3 className="text-sm font-semibold">Scheduled events</h3>
          <button type="button" onClick={() => update({ events: [...form.events, blankEvent()] })} className="rounded-full border border-border px-4 py-1.5 text-sm font-medium hover:bg-bg">
            Add event
          </button>
        </div>
        {form.events.length === 0 ? <p className="text-sm text-text-muted">No events yet. Add one and the decoration switches on and off by itself on the dates you pick.</p> : null}

        {form.events.map((e) => (
          <div key={e.id} className="flex flex-col gap-3 rounded-xl border border-border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminField label="Event name" required>
                <input value={e.name} onChange={(ev) => updateEvent(e.id, { name: ev.target.value })} maxLength={80} placeholder="Diwali 2026" className={adminFieldInputClass} />
              </AdminField>
              <AdminField label="Decoration">
                <select value={e.decoration} onChange={(ev) => updateEvent(e.id, { decoration: ev.target.value })} className={adminFieldInputClass}>
                  {HERO_DECORATION_IDS.map((id) => (
                    <option key={id} value={id}>
                      {HERO_DECORATIONS[id].label}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Starts" required>
                <input type="date" value={e.start} onChange={(ev) => updateEvent(e.id, { start: ev.target.value })} className={adminFieldInputClass} />
              </AdminField>
              <AdminField label="Ends (inclusive)" required>
                <input type="date" value={e.end} min={e.start} onChange={(ev) => updateEvent(e.id, { end: ev.target.value })} className={adminFieldInputClass} />
              </AdminField>
            </div>
            <AdminField label="Greeting shown above the title">
              <input value={e.greeting} onChange={(ev) => updateEvent(e.id, { greeting: ev.target.value })} maxLength={120} placeholder={HERO_DECORATIONS[e.decoration].greeting} className={adminFieldInputClass} />
            </AdminField>
            <details className="text-sm">
              <summary className="cursor-pointer text-xs font-medium text-primary">Replace the title and description during this event</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <AdminField label="Badge">
                  <input value={e.badge} onChange={(ev) => updateEvent(e.id, { badge: ev.target.value })} maxLength={80} className={adminFieldInputClass} />
                </AdminField>
                <AdminField label="Title (white part)">
                  <input value={e.titleLead} onChange={(ev) => updateEvent(e.id, { titleLead: ev.target.value })} maxLength={80} className={adminFieldInputClass} />
                </AdminField>
                <AdminField label="Title (highlighted part)">
                  <input value={e.titleAccent} onChange={(ev) => updateEvent(e.id, { titleAccent: ev.target.value })} maxLength={80} className={adminFieldInputClass} />
                </AdminField>
                <AdminField label="Description">
                  <input value={e.subtitle} onChange={(ev) => updateEvent(e.id, { subtitle: ev.target.value })} maxLength={240} className={adminFieldInputClass} />
                </AdminField>
              </div>
            </details>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={e.enabled} onChange={(ev) => updateEvent(e.id, { enabled: ev.target.checked })} />
                Enabled
              </label>
              <button type="button" onClick={() => update({ events: form.events.filter((x) => x.id !== e.id) })} className="text-xs font-medium text-danger hover:underline">
                Delete event
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">Preview</h2>
        <DecorationPreview form={form} />
      </section>
    </form>
  );
}

// Shows the base banner with the always-on decoration, or lets the admin try any preset.
function DecorationPreview({ form }) {
  const [trial, setTrial] = useState("");
  const id = trial || form.manualDecoration || "";
  const image = form.slides[0]?.url;
  return (
    <div className="flex flex-col gap-3">
      <select value={trial} onChange={(e) => setTrial(e.target.value)} aria-label="Preview a decoration" className={`${adminFieldInputClass} max-w-xs`}>
        <option value="">{form.manualDecoration ? "Current setting" : "No decoration"}</option>
        {HERO_DECORATION_IDS.map((d) => (
          <option key={d} value={d}>
            {HERO_DECORATIONS[d].label}
          </option>
        ))}
      </select>
      <div className="relative h-64 overflow-hidden rounded-2xl bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
        <div className="absolute inset-0 bg-ink/60" />
        <HeroDecoration id={id} />
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center text-white">
          {id ? <p className="mb-1 font-semibold text-accent">{HERO_DECORATIONS[id].greeting}</p> : null}
          <p className="text-2xl font-extrabold sm:text-4xl">
            {form.titleLead || "Find the right place,"} <span className="text-accent">{form.titleAccent || (form.titleLead ? "" : "without the noise.")}</span>
          </p>
          <p className="mt-2 max-w-md text-sm text-white/90">{form.subtitle || "Search reviewed listings for sale and rent, and contact owners and agents directly."}</p>
        </div>
      </div>
    </div>
  );
}
