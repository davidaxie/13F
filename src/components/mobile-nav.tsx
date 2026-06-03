"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Mobile / split-screen primary nav.
 *
 * Hidden on `xl` and above — the desktop nav inside layout.tsx takes over
 * there. At narrower widths (split-screen on a 13" laptop, iPad portrait,
 * any phone) this hamburger menu surfaces the same 11 links a stacked
 * panel. The button itself remains in the header's right cluster so the
 * 13F logo + auth controls never get word-wrapped.
 */
const PRIMARY_LINKS: Array<{ href: string; label: string }> = [
  { href: "/", label: "Search" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/entries", label: "Entries" },
  { href: "/consensus", label: "Consensus" },
  { href: "/universe", label: "Universe" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/compare", label: "Compare" },
  { href: "/backtest/follower", label: "Follower" },
  { href: "/backtest/conviction", label: "Conviction" },
  { href: "/watchlist", label: "Following" },
  { href: "/about", label: "About & methodology" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Click-outside + escape close. Only attach listeners while the menu is
  // open — avoids a global mousedown handler firing on every interaction.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative xl:hidden" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="primary-mobile-nav"
        className="-m-2 inline-flex h-10 w-10 items-center justify-center rounded text-muted transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          {open ? (
            <>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </>
          ) : (
            <>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </>
          )}
        </svg>
      </button>
      {open && (
        <nav
          id="primary-mobile-nav"
          aria-label="Primary"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded border border-hairline bg-background py-1 shadow-lg"
        >
          {PRIMARY_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-muted transition-colors hover:bg-subtle/40 hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <div className="my-1 border-t border-hairline" />
          <a
            href="https://www.sec.gov/divisions/investment/13ffaq"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-muted transition-colors hover:bg-subtle/40 hover:text-foreground"
          >
            About 13F (SEC)
          </a>
        </nav>
      )}
    </div>
  );
}
