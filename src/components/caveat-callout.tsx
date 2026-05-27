import Link from "next/link";

export type CaveatItem = {
  /** Short bold-able label, e.g. "Survivor-biased universe". */
  title: string;
  /** Plain-text body, ~12-25 words. */
  body: string;
};

/**
 * A condensed callout meant for the TOP of backtest / analytical pages —
 * surfaces the 2-3 most material caveats inline, alongside an anchor link
 * down to the full bottom-of-page caveats section.
 *
 * Buried caveats below the fold don't get read; this puts the load-bearing
 * disclosures next to the headline.
 */
export function CaveatCallout({
  items,
  anchor = "#caveats",
}: {
  items: CaveatItem[];
  /**
   * Hash to jump to on "Full list ↓". Pass `null` to suppress the link when
   * the page has no separate bottom caveats section (the callout IS the
   * full list).
   */
  anchor?: string | null;
}) {
  if (items.length === 0) return null;
  return (
    <aside
      className="mt-8 rounded border-l-2 border-negative/40 bg-negative/5 px-5 py-4"
      role="note"
      aria-label="Material caveats"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[10px] uppercase tracking-widest text-negative/80">
          Read first · material caveats
        </div>
        {anchor && (
          <Link
            href={anchor}
            className="text-[10px] uppercase tracking-widest text-muted transition-colors hover:text-foreground"
          >
            Full list ↓
          </Link>
        )}
      </div>
      <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
        {items.map((c) => (
          <li key={c.title}>
            <strong className="text-foreground/90">{c.title}.</strong> {c.body}
          </li>
        ))}
      </ul>
    </aside>
  );
}
