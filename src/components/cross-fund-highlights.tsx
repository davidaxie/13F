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

export async function CrossFundHighlights() {
  const diffs = await getAllFundDiffs();
  const allMoves = diffs.flatMap((d) => d.moves);

  // Common stock buckets (exclude options so each section is comparable in
  // semantics and dollar units).
  const newLong = allMoves
    .filter((m) => m.type === "new" && isCommonStock(m))
    .sort((a, b) => b.currentValueUsd - a.currentValueUsd);

  const exits = allMoves
    .filter((m) => m.type === "exited" && isCommonStock(m))
    .sort((a, b) => b.prevValueUsd - a.prevValueUsd);

  const adds = allMoves
    .filter((m) => m.type === "added" && isCommonStock(m))
    .sort((a, b) => b.deltaUsd - a.deltaUsd);

  const trims = allMoves
    .filter((m) => m.type === "trimmed" && isCommonStock(m))
    .sort((a, b) => a.deltaUsd - b.deltaUsd);

  // Options: only new opens (bullish via calls / bearish via puts).
  const shortOpens = allMoves
    .filter((m) => m.type === "new" && isPut(m))
    .sort((a, b) => b.currentValueUsd - a.currentValueUsd);

  const callOpens = allMoves
    .filter((m) => m.type === "new" && isCall(m))
    .sort((a, b) => b.currentValueUsd - a.currentValueUsd);

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
