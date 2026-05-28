import { getAllFundDiffs, type Move } from "@/lib/dashboard";
import { CrossFundHighlightsView } from "./cross-fund-highlights-view";

function isPut(m: Move): boolean {
  return (m.putCall ?? "").toUpperCase() === "PUT";
}
function isCall(m: Move): boolean {
  return (m.putCall ?? "").toUpperCase() === "CALL";
}
function isCommonStock(m: Move): boolean {
  return !m.putCall;
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

export async function CrossFundHighlights() {
  const diffs = await getAllFundDiffs();
  const allMoves = diffs.flatMap((d) => d.moves);

  // Common stock buckets (exclude options so each section is comparable in
  // semantics and dollar units). Sorted by magnitude, then capped.
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

  return (
    <CrossFundHighlightsView
      newLong={newLong}
      exits={exits}
      adds={adds}
      trims={trims}
      shortOpens={shortOpens}
      callOpens={callOpens}
    />
  );
}
