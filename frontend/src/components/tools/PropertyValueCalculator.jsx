"use client";

import { useMemo, useState } from "react";
import { PROPERTY_TYPE_LABELS } from "@/lib/propertyTypes";
import { CITY_RATE_PER_SQFT, DEFAULT_RATE_PER_SQFT, PROPERTY_TYPE_MULTIPLIER, ageMultiplier } from "@/lib/cityRates";
import { formatPrice } from "@/lib/format";

const CITIES = Object.keys(CITY_RATE_PER_SQFT).sort();
const TYPES = Object.keys(PROPERTY_TYPE_MULTIPLIER);

const fieldLabel = "mb-1.5 block text-xs font-medium text-text-muted";
const fieldInput =
  "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm outline-none focus:border-primary";

export function PropertyValueCalculator() {
  const [city, setCity] = useState(CITIES[0]);
  const [propertyType, setPropertyType] = useState("apartment");
  const [area, setArea] = useState(1200);
  const [age, setAge] = useState(3);

  const { low, mid, high, rate } = useMemo(() => {
    const baseRate = CITY_RATE_PER_SQFT[city] ?? DEFAULT_RATE_PER_SQFT;
    const effectiveRate = baseRate * (PROPERTY_TYPE_MULTIPLIER[propertyType] ?? 1) * ageMultiplier(Number(age) || 0);
    const midValue = effectiveRate * (Number(area) || 0);
    return { low: midValue * 0.9, mid: midValue, high: midValue * 1.1, rate: effectiveRate };
  }, [city, propertyType, area, age]);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form className="flex flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
        <div>
          <label className={fieldLabel} htmlFor="pv-city">
            City
          </label>
          <select id="pv-city" value={city} onChange={(e) => setCity(e.target.value)} className={fieldInput}>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={fieldLabel} htmlFor="pv-type">
            Property type
          </label>
          <select
            id="pv-type"
            value={propertyType}
            onChange={(e) => setPropertyType(e.target.value)}
            className={fieldInput}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {PROPERTY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={fieldLabel} htmlFor="pv-area">
            Built-up area (sq.ft)
          </label>
          <input
            id="pv-area"
            type="number"
            min={100}
            value={area}
            onChange={(e) => setArea(e.target.value)}
            className={fieldInput}
          />
        </div>

        <div>
          <label className={fieldLabel} htmlFor="pv-age">
            Property age (years)
          </label>
          <input
            id="pv-age"
            type="number"
            min={0}
            max={80}
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className={fieldInput}
          />
        </div>
      </form>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm text-text-muted">Estimated value range</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-primary sm:text-3xl">
          {formatPrice(Math.round(low))} &ndash; {formatPrice(Math.round(high))}
        </p>
        <p className="mt-1 text-sm text-text-muted">Midpoint estimate: {formatPrice(Math.round(mid))}</p>

        <dl className="mt-6 flex flex-col gap-3 border-t border-border pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-muted">Applied rate</dt>
            <dd className="font-medium">₹{Math.round(rate).toLocaleString("en-IN")}/sq.ft</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">Built-up area</dt>
            <dd className="font-medium">{(Number(area) || 0).toLocaleString("en-IN")} sq.ft</dd>
          </div>
        </dl>

        <p className="mt-4 text-xs text-text-muted">
          Indicative estimate based on average locality rates, not a valuation or offer. Actual price depends on
          exact location, condition, and amenities — a Featured/Verified listing near you is a better reference
          point.
        </p>
      </div>
    </div>
  );
}
