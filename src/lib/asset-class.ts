// Asset-class classifier for 13F holdings. Used by the dashboard / consensus /
// per-style entries layers to separate passive-instrument flow (ETFs, treasury
// funds) from single-name common-stock theses — the two carry very different
// signal weight and shouldn't be ranked in the same buckets.
//
// === How to extend ===
// 1. To add an ETF / treasury fund / other passive instrument: append the
//    9-character CUSIP to the appropriate Set below.
// 2. Source CUSIPs from src/lib/cusip-seed.json (`grep` for the ticker), or
//    from a snapshot file under src/data/backtest/ if the ticker only appears
//    via 13F filings. ALWAYS verify the CUSIP corresponds to the US-listed
//    primary issue — Bloomberg German / ASX shadows reuse some prefixes.
// 3. Treasury-bond ETFs go in TREASURY_ETF_CUSIPS so the consumer can apply
//    a different filter (e.g. surface separately in a "duration" section)
//    even though they're a subset of ETFs in the broader sense.
// 4. Options are flagged upstream via `putCall`; we don't classify them by
//    CUSIP here.
// 5. Default for anything not listed: "common" — i.e. treat as single-name
//    equity. The cost of a miss is one ETF leaking into the new-positions
//    section; the cost of an over-broad rule is real holdings being filtered
//    out.

export type AssetClass = "common" | "etf" | "treasuryEtf" | "option" | "other";

// Treasury-bond ETFs (kept as a subset of `etf` semantically — the classifier
// returns "treasuryEtf" so duration-oriented vehicles can be filtered or
// surfaced separately from broad equity ETFs).
const TREASURY_ETF_CUSIPS = new Set<string>([
  "464287440", // IEF — iShares 7-10 Year Treasury Bond (verified in cusip-seed.json)
  "464287432", // TLT — iShares 20+ Year Treasury Bond (verified)
  "464288679", // SHV — iShares 0-1 Year Treasury Bond (verified — spec called it Short Treasury)
]);

// Broad / sector / regional ETFs. Treasury ETFs are excluded here and live in
// TREASURY_ETF_CUSIPS — assetClassForCusip checks both.
const ETF_CUSIPS = new Set<string>([
  "78462F103", // SPY — SPDR S&P 500 ETF Trust (verified)
  "464287200", // IVV — iShares Core S&P 500 (verified)
  "922908363", // VOO — Vanguard S&P 500 (verified)
  "922908769", // VTI — Vanguard Total Stock Market (verified)
  "46090E103", // QQQ — Invesco QQQ Trust (verified — seed ticker is the BetaShares ASX shadow "NDQ", but the CUSIP is unambiguously the US Invesco fund)
  "78463V107", // GLD — SPDR Gold Shares (verified — seed ticker is the German shadow "GQ9" but the CUSIP is the US ETF)
  "464287655", // IWM — iShares Russell 2000 (verified)
  "92189F676", // SMH — VanEck Semiconductor ETF (verified — spec listed 812383307 but that CUSIP is not present; the seed has SMH at this CUSIP and the ETF's prospectus confirms it)
  "464288513", // HYG — iShares iBoxx $ High Yield Corporate Bond (verified)
  "464287234", // EEM — iShares MSCI Emerging Markets (verified — spec listed this as IEF but it is actually EEM in the seed; IEF's real CUSIP is 464287440, already added above. Keeping EEM here as a broad-market ETF that should still be filtered out of consensus.)
  // EMXC (iShares MSCI EM ex-China): spec gave 46434V480 but this CUSIP is not
  // present in cusip-seed.json. The likely real CUSIP is 46435U499 per
  // iShares' product page, but without seed corroboration this is a GUESS —
  // leaving out rather than risk filtering out a real holding. Add manually
  // if a future EMXC position confirms the CUSIP.
  // SPDR Gold note: spec also asked for 78463V107 → GLD, which is what we use.
]);

/**
 * Classify a CUSIP into an asset class. Defaults to "common" for anything
 * not in the curated maps — favor false negatives (one ETF in the long
 * list) over false positives (real holdings disappearing).
 *
 * Note: options are NOT classified here. They're flagged on the Move /
 * Holding object via `putCall` and filtered upstream.
 */
export function assetClassForCusip(cusip: string): AssetClass {
  if (TREASURY_ETF_CUSIPS.has(cusip)) return "treasuryEtf";
  if (ETF_CUSIPS.has(cusip)) return "etf";
  return "common";
}
