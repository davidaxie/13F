import type { FundBacktest } from "./backtest";

// Static imports so Next.js bundles the JSON into the server build.
// Each file is a pre-computed runBacktest() result for one marquee fund;
// generated locally via /api/snapshot/[cik] and committed to git, so the
// production leaderboard reads them as static data instead of running the
// full backtest against SEC + Yahoo on every request.
import berkshire from "../data/backtest/1067983.json";
import pershing from "../data/backtest/1336528.json";
import tigerGlobal from "../data/backtest/1167483.json";
import renaissance from "../data/backtest/1037389.json";
import bridgewater from "../data/backtest/1350694.json";
import citadel from "../data/backtest/1423053.json";
import soros from "../data/backtest/1029160.json";
import appaloosa from "../data/backtest/1656456.json";
import twoSigma from "../data/backtest/1179392.json";
// UE-01 new funds (generated 2026-05-28). Concentrated activists / Tiger
// Cubs / solos — full history, all validated ≥64% CUSIP coverage with
// healthy (non-flat) equity curves.
//
// TWO of the 18 UE-01 funds are still NOT wired — they fall back to the
// graceful "pending" state:
//   • Trian (1345472) — pre-2012 13F filings aren't in the XML format
//     the parser expects ("No information table XML found in filing"),
//     so EVERY historical filing fails and the snapshot is 0 trades.
//     This is a parser scope limitation, not a transient — a retry
//     won't fix it. Wire it once the parser handles legacy 13Fs.
//   • Starboard (1517137) — only 28% of CUSIPs map via the bundled seed
//     (small-cap activist targets); too low to represent the book without
//     an OpenFIGI key to expand the mapping.
import elliott from "../data/backtest/1048445.json";
import thirdPoint from "../data/backtest/1040273.json";
import lonePine from "../data/backtest/1061165.json";
import coatue from "../data/backtest/1135730.json";
import viking from "../data/backtest/1103804.json";
import d1 from "../data/backtest/1747057.json";
import greenlight from "../data/backtest/1079114.json";
import glenview from "../data/backtest/1138995.json";
import scion from "../data/backtest/1649339.json";
import maverick from "../data/backtest/934639.json";
import jana from "../data/backtest/1159159.json";
import duquesne from "../data/backtest/1536411.json";
// Heavy quant books — capped to 8 recent quarters at generation time so the
// Yahoo fetch volume stays manageable. Validated ≥75% ticker coverage and
// healthy equity curves (~95 daily points each).
import deShaw from "../data/backtest/1009207.json";
import aqr from "../data/backtest/1167557.json";
import millennium from "../data/backtest/1273087.json";
import point72 from "../data/backtest/1603466.json";

const SNAPSHOTS: Record<string, FundBacktest> = {
  "1067983": berkshire as unknown as FundBacktest,
  "1336528": pershing as unknown as FundBacktest,
  "1167483": tigerGlobal as unknown as FundBacktest,
  "1037389": renaissance as unknown as FundBacktest,
  "1350694": bridgewater as unknown as FundBacktest,
  "1423053": citadel as unknown as FundBacktest,
  "1029160": soros as unknown as FundBacktest,
  "1656456": appaloosa as unknown as FundBacktest,
  "1179392": twoSigma as unknown as FundBacktest,
  "1048445": elliott as unknown as FundBacktest,
  "1040273": thirdPoint as unknown as FundBacktest,
  "1061165": lonePine as unknown as FundBacktest,
  "1135730": coatue as unknown as FundBacktest,
  "1103804": viking as unknown as FundBacktest,
  "1747057": d1 as unknown as FundBacktest,
  "1079114": greenlight as unknown as FundBacktest,
  "1138995": glenview as unknown as FundBacktest,
  "1649339": scion as unknown as FundBacktest,
  "934639": maverick as unknown as FundBacktest,
  "1159159": jana as unknown as FundBacktest,
  "1536411": duquesne as unknown as FundBacktest,
  "1009207": deShaw as unknown as FundBacktest,
  "1167557": aqr as unknown as FundBacktest,
  "1273087": millennium as unknown as FundBacktest,
  "1603466": point72 as unknown as FundBacktest,
};

export function getSnapshot(cik: string): FundBacktest | null {
  const cleanCik = cik.replace(/^0+/, "");
  return SNAPSHOTS[cleanCik] ?? null;
}
