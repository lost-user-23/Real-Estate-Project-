"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/trackEvent";

export function PostPropertyButton({ source, prefill, variant = "solid", className = "" }) {
  const params = new URLSearchParams();
  if (prefill?.city) params.set("city", prefill.city);
  if (prefill?.propertyType) params.set("propertyType", prefill.propertyType);
  const href = params.toString() ? `/post-property?${params.toString()}` : "/post-property";

  const base = "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition-colors";
  const styles =
    variant === "solid"
      ? "bg-accent text-accent-ink hover:bg-accent-dark"
      : "border border-primary text-primary hover:bg-primary hover:text-white";

  return (
    <Link href={href} onClick={() => trackEvent("post_property_click", { source })} className={`${base} ${styles} ${className}`}>
      Post Property
    </Link>
  );
}
