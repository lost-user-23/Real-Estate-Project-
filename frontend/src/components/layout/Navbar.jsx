"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLoginPrompt } from "@/lib/login-prompt-context";
import { Container } from "@/components/ui/Container";
import { PostPropertyButton } from "@/components/PostPropertyButton";
import { CitySelector } from "@/components/layout/CitySelector";
import { CloseIcon, MenuIcon } from "@/components/icons";

const NAV_LINKS = [
  { href: "/search?intent=buy", label: "Buy" },
  { href: "/search?intent=rent", label: "Rent" },
  { href: "/post-property", label: "Sell" },
  { href: "/search?propertyType=commercial", label: "Commercial" },
  { href: "/#new-projects", label: "New Projects" },
  { href: "/tools", label: "Tools" },
];

const SCROLL_THRESHOLD = 24;

function AdminBadge() {
  return (
    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
      admin
    </span>
  );
}

export function Navbar() {
  const { isLoggedIn, logout, user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { requestLogin } = useLoginPrompt();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === "/";

  useEffect(() => {
    if (!isHome) return undefined;
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  // Only the home page has a hero image for the header to blend into; every
  // other page (and the home page once scrolled past the hero) gets the
  // solid header so nav text stays readable over plain page content.
  const transparent = isHome && !scrolled && !mobileOpen;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        transparent
          ? "bg-transparent"
          : "border-b border-border bg-surface/95 backdrop-blur"
      }`}
    >
      <Container className="flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <Link
            href="/"
            className={`flex items-center gap-2 text-lg font-bold tracking-tight ${
              transparent ? "text-white" : "text-primary"
            }`}
          >
            <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              H
            </span>
            HomeNest
          </Link>
          <span className={`mx-1 hidden h-6 w-px sm:block ${transparent ? "bg-white/30" : "bg-border"}`} aria-hidden />
          <CitySelector transparent={transparent} />
        </div>

        <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={`text-sm font-medium transition-colors ${
                transparent ? "text-white/90 hover:text-white" : "text-text hover:text-primary"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {isLoggedIn ? (
            <>
              {user?.name ? (
                <span
                  className={`flex items-center gap-1.5 text-sm font-medium ${transparent ? "text-white" : "text-text"}`}
                >
                  <span className="max-w-32 truncate">{user.name}</span>
                  {isAdmin ? <AdminBadge /> : null}
                </span>
              ) : null}
              <Link
                href="/saved"
                className={`text-sm font-medium transition-colors ${
                  transparent ? "text-white/90 hover:text-white" : "text-text hover:text-primary"
                }`}
              >
                Saved
              </Link>
              <Link
                href="/profile"
                className={`text-sm font-medium transition-colors ${
                  transparent ? "text-white/90 hover:text-white" : "text-text hover:text-primary"
                }`}
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={logout}
                className={`text-sm font-medium transition-colors ${
                  transparent ? "text-white/90 hover:text-white" : "text-text hover:text-primary"
                }`}
              >
                Log out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => requestLogin()}
              className={`text-sm font-medium transition-colors ${
                transparent ? "text-white/90 hover:text-white" : "text-text hover:text-primary"
              }`}
            >
              Login or Sign up
            </button>
          )}
          <PostPropertyButton source="navbar" />
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className={`rounded-lg p-2 lg:hidden ${
            transparent ? "text-white hover:bg-white/10" : "text-text hover:bg-bg"
          }`}
        >
          {mobileOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>
      </Container>

      {mobileOpen ? (
        <div className="border-t border-border bg-surface lg:hidden">
          <Container className="flex flex-col gap-1 py-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-2 py-2.5 text-sm font-medium text-text hover:bg-bg"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
              {isLoggedIn ? (
                <>
                  {user?.name ? (
                    <p className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium text-text">
                      <span className="truncate">{user.name}</span>
                      {isAdmin ? <AdminBadge /> : null}
                    </p>
                  ) : null}
                  <Link
                    href="/saved"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-2 py-2.5 text-sm font-medium text-text hover:bg-bg"
                  >
                    Saved
                  </Link>
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-lg px-2 py-2.5 text-sm font-medium text-text hover:bg-bg"
                  >
                    Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setMobileOpen(false);
                    }}
                    className="rounded-lg px-2 py-2.5 text-left text-sm font-medium text-text hover:bg-bg"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    requestLogin();
                    setMobileOpen(false);
                  }}
                  className="rounded-lg px-2 py-2.5 text-left text-sm font-medium text-text hover:bg-bg"
                >
                  Login or Sign up
                </button>
              )}
              <PostPropertyButton source="navbar" className="w-full" />
            </div>
          </Container>
        </div>
      ) : null}
    </header>
  );
}
