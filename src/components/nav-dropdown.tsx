"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Item = { href: string; label: string; sub?: string };

/**
 * Click-to-open header dropdown used for "Funds" and "Backtest" — groups
 * related routes under a single top-level slot so the nav stays at 5
 * primary items instead of 11. Keyboard-accessible (Escape closes,
 * aria-expanded reflects state) and closes on outside click / touch /
 * link navigation.
 */
export function NavDropdown({
  label,
  items,
}: {
  label: string;
  items: Item[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-muted transition-colors hover:text-foreground"
      >
        {label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          aria-hidden="true"
          className={
            open
              ? "rotate-180 transition-transform"
              : "transition-transform"
          }
        >
          <path d="M3 4.5 L6 7.5 L9 4.5" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 w-56 overflow-hidden rounded border border-hairline bg-background py-1 shadow-lg"
        >
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-muted transition-colors hover:bg-subtle/40 hover:text-foreground"
            >
              <span className="block">{it.label}</span>
              {it.sub && (
                <span className="mt-0.5 block text-[11px] text-muted/60">
                  {it.sub}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
