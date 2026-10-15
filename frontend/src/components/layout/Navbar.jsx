"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useLoginPrompt } from "@/lib/login-prompt-context";
import { Container } from "@/components/ui/Container";
import { PostPropertyButton } from "@/components/PostPropertyButton";
import { CitySelector } from "@/components/layout/CitySelector";
import { NavMegaMenus } from "@/components/layout/NavMegaMenus";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { CloseIcon, MenuIcon } from "@/components/icons";

const NAV_LINKS = [
  { href: "/search?intent=buy", label: "Buy" },
  { href: "/search?intent=rent", label: "Rent" },
  { href: "/post-property", label: "Sell" },
  { href: "/search?propertyType=commercial", label: "Commercial" },
  { href: "/#new-projects", label: "New Projects" },
  { href: "/tools", label: "Tools" },
  { href: "/#insights", label: "Insights" },
];

// Desktop shows these as dropdowns (NavMegaMenus); mobile keeps them as flat links.
const MENU_LABELS = ["Buy", "Rent", "Sell"];

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
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        transparent
          ? "bg-transparent"
          : "border-b border-border/70 bg-surface/85 shadow-lg shadow-black/5 backdrop-blur-xl"
      }`}
    >
      <div className="flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-6 2xl:px-10">
        <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
          <Link
            href="/"
            className={`flex items-center gap-2 text-lg font-bold tracking-tight ${
              transparent ? "text-white" : "text-primary"
            }`}
          >
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-primary to-[#12a09e] text-white shadow-md shadow-primary/30"
            >
              H
            </span>
            HomeNest
          </Link>
          <span className={`mx-1 hidden h-6 w-px sm:block ${transparent ? "bg-white/30" : "bg-border"}`} aria-hidden />
          <CitySelector transparent={transparent} />
        </div>

        <NavMegaMenus transparent={transparent} />

        <nav aria-label="Secondary" className="hidden items-center gap-5 whitespace-nowrap xl:flex">
          {NAV_LINKS.filter((link) => !MENU_LABELS.includes(link.label)).map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={`relative py-1 text-sm font-semibold transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-accent after:transition-transform hover:after:scale-x-100 ${
                transparent ? "text-white/90 hover:text-white" : "text-text hover:text-primary"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 whitespace-nowrap xl:flex">
          {isLoggedIn ? (
            <AccountMenu user={user} isAdmin={isAdmin} logout={logout} transparent={transparent} />
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
          <PostPropertyButton source="navbar" className="whitespace-nowrap" />
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className={`rounded-lg p-2 xl:hidden ${
            transparent ? "text-white hover:bg-white/10" : "text-text hover:bg-bg"
          }`}
        >
          {mobileOpen ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
        </button>
      </div>

      {mobileOpen ? (
        <div className="border-t border-border bg-surface xl:hidden">
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
