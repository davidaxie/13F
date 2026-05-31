import Link from "next/link";
import { assetClassForCusip, tickerForCusip } from "@/lib/cusip-lookup";
import { getAllFundDiffs, type Move } from "@/lib/dashboard";
import { formatUSD } from "@/lib/format";
import {
  CrossFundHighlightsView,
  type MoveWithTicker,
} from "./cross-fund-highlights-view";

// Resolve the CUSIP→ticker here on the server so the lookup map never ships to
// the browser. The view leads each row with the ticker (the primary
// identifier) rather than the underlying company name.
function withTicker(m: Move): MoveWithTicker {
  return { ...m, ticker: tickerForCusip(m.cusip) };
}

function isPut(m: Move): boolean {
  return (m.putCall ?? "").toUpperCase() === "PUT";
}
function isCall(m: Move): boolean {
  return (m.putCall ?? "").toUpperCase() === "CALL";
}
// Single-name common-stock: no option attached AND not a passive instrument
// (ETF / treasury fund). ETFs leak signal into "biggest new positions" rows —
// a fund opening SPY tells you nothing about a single-name thesis — so they're
// surfaced separately in the ETF-flows section below.
function isCommonStock(m: Move): boolean {
  return !m.putCall && assetClassForCusip(m.cusip) === "common";
}
function isEtf(m: Move): boolean {
  if (m.putCall) return false;
  const cls = assetClassForCusip(m.cusip);
  return cls === "etf" || cls === "treasuryEtf";
}

// Cap each section to its top-N moves by magnitude BEFORE handing the arrays
// to the client component. CrossFundHighlightsView is a "use client"
// component, so whatever we pass is serialized into the SSR HTML *and* the
// RSC hydration stream (i.e. shipped twice). With the 27-fund universe the
// uncapped arrays were ~36k Move objects → a ~16MB /dashboard payload.
//
// The UI only ever shows 12 rows per section (with a "show all" expander),
// and the cohort/sector filters operate within whatever's passed — so 200
// top-by-value moves per section keeps every material move and keeps the
// filters useful, while cutting the payload ~16×. The long tail of tiny
// sub-$1M moves isn't what a "biggest moves" dashboard is for.
const SECTION_CAP = 200;
const ETF_FLOW_CAP = 12;

export async function CrossFundHighlights() {
  const diffs = await getAllFundDiffs();
  const allMoves = diffs.flatMap((d) => d.moves);

  // Common stock buckets (exclude options + ETFs so each section is
  // comparable in semantics and dollar units). Sorted by magnitude, then
  // capped.
  const newLong = allMoves
    .filter((m) => m.type === "new" && isCommonStock(m))
    .sort((a, b) => b.currentValueUsd - a.currentValueUsd)
    .slice(0, SECTION_CAP);

  const exits = allMoves
    .filter((m) => m.type === "exited" && isCommonStock(m))
    .sort((a, b) => b.prevValueUsd - a.prevValueUsd)
    .slice(0, SECTION_CAP);

  const adds = allMoves
    .filter((m) => m.type === "added" && isCommonStock(m))
    .sort((a, b) => b.deltaUsd - a.deltaUsd)
    .slice(0, SECTION_CAP);

  const trims = allMoves
    .filter((m) => m.type === "trimmed" && isCommonStock(m))
    .sort((a, b) => a.deltaUsd - b.deltaUsd)
    .slice(0, SECTION_CAP);

  // Options: only new opens (bullish via calls / bearish via puts). These are
  // sparse in 13F so the cap rarely binds, but applied for consistency.
  const shortOpens = allMoves
    .filter((m) => m.type === "new" && isPut(m))
    .sort((a, b) => b.currentValueUsd - a.currentValueUsd)
    .slice(0, SECTION_CAP);

  const callOpens = allMoves
    .filter((m) => m.type === "new" && isCall(m))
    .sort((a, b) => b.currentValueUsd - a.currentValueUsd)
    .slice(0, SECTION_CAP);

  // NEW: ETF / treasury-fund opens. Surfaced separately because a fund
  // opening SPY/IEF/GLD isn't a single-name thesis — but it IS a regime
  // signal worth seeing (e.g. multiple macro funds piling into TLT).
  const etfNew = allMoves
    .filter((m) => m.type === "new" && isEtf(m))
    .sort((a, b) => b.currentValueUsd - a.currentValueUsd)
    .slice(0, ETF_FLOW_CAP)
    .map(withTicker);

  return (
    <>
      <CrossFundHighlightsView
        newLong={newLong.map(withTicker)}
        exits={exits.map(withTicker)}
        adds={adds.map(withTicker)}
        trims={trims.map(withTicker)}
        shortOpens={shortOpens.map(withTicker)}
        callOpens={callOpens.map(withTicker)}
      />
      {etfNew.length > 0 ? (
        <section
          className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
          aria-labelledby="etf-flows-heading"
        >
          <header className="mb-3">
            <h2
              id="etf-flows-heading"
              className="text-base font-semibold text-neutral-900"
            >
              ETF flows (new)
            </h2>
            <p className="text-xs text-neutral-500">
              Passive-instrument opens — surfaced separately from single-name
              theses. Top {etfNew.length} by current value.
            </p>
          </header>
          <ul className="divide-y divide-neutral-100">
            {etfNew.map((m, i) => {
              return (
                <li
                  key={`${m.fundCik}-${m.cusip}-${i}`}
                  className="flex items-center justify-between gap-4 py-2 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="font-mono text-xs font-medium text-neutral-900">
                      {m.ticker ?? m.cusip}
                    </span>
                    <span className="truncate text-neutral-600">
                      {m.issuer}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-xs text-neutral-500">
                    <Link
                      href={`/fund/${m.fundCik}`}
                      className="hover:text-neutral-900 hover:underline"
                    >
                      {m.fundName}
                    </Link>
                    <span className="font-mono tabular-nums text-neutral-900">
                      {formatUSD(m.currentValueUsd)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </>
  );
}
