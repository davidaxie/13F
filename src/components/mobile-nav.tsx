"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Mobile / split-screen primary nav.
 *
 * Hidden on `lg` and above — the desktop nav (5 items + 2 dropdowns +
 * watchlist star) inside layout.tsx takes over there. Below lg
 * (split-screen on a 13" Mac, iPad portrait, any phone) this hamburger
 * surfaces every route in a flat stacked panel — one tap from menu to
 * destination, no nested groupings. The button itself stays in the
 * header's right cluster so the 13F logo + auth controls always have
 * room.
 */
type Section = { header: string; items: Array<{ href: string; label: string }> };
const SECTIONS: Section[] = [
  {
    header: "Discover",
    items: [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/consensus", label: "Consensus" },
      { href: "/entries", label: "Entries" },
      { href: "/", label: "Search" },
    ],
  },
  {
    header: "Funds",
    items: [
      { href: "/universe", label: "Universe" },
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/compare", label: "Compare" },
    ],
  },
  {
    header: "Backtest",
    items: [
      { href: "/backtest/follower", label: "Follower" },
      { href: "/backtest/conviction", label: "Conviction" },
    ],
  },
  {
    header: "You",
    items: [
      { href: "/watchlist", label: "Watchlist" },
      { href: "/about", label: "About & methodology" },
    ],
  },
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
    <div className="relative lg:hidden" ref={wrapRef}>
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
          className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded border border-hairline bg-background py-2 shadow-lg"
        >
          {SECTIONS.map((section, idx) => (
            <div key={section.header}>
              {idx > 0 && <div className="my-1 border-t border-hairline" />}
              <div className="px-4 py-1 text-[10px] uppercase tracking-widest text-muted/60">
                {section.header}
              </div>
              {section.items.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-2 text-sm text-muted transition-colors hover:bg-subtle/40 hover:text-foreground"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="my-1 border-t border-hairline" />
          <a
            href="https://www.sec.gov/divisions/investment/13ffaq"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-muted transition-colors hover:bg-subtle/40 hover:text-foreground"
          >
            About 13F (SEC) ↗
          </a>
        </nav>
      )}
    </div>
  );
}
