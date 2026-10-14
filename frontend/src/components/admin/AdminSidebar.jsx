"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/hero", label: "Home banner" },
  { href: "/admin/locations", label: "Popular locations" },
  { href: "/admin/projects", label: "New projects" },
  { href: "/admin/articles", label: "Insights" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/messages", label: "Messages" },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex flex-col gap-1 p-4">
      {NAV_ITEMS.map((item) => {
        const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive ? "bg-primary text-white" : "text-text hover:bg-bg"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
