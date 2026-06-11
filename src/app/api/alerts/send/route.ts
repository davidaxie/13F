import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { Resend } from "resend";
import crypto from "crypto";
import {
  detectMaterialMovesFromHoldings,
  type MaterialMove,
} from "@/lib/alerts";
import { getFundInfo, getHoldings, type Holding } from "@/lib/edgar";
import { MARQUEE_FUNDS } from "@/lib/funds";

export const dynamic = "force-dynamic";
// Each hourly run polls EDGAR for every subscribed CIK. In steady state that's
// one cheap submissions fetch per fund; only when a fund's latest filing
// actually changes do we pull the (larger) holdings tables. 60s is the Vercel
// cap; any CIKs not reached this run are simply picked up next hour (their
// per-CIK marker isn't advanced until they're processed).
export const maxDuration = 60;

// Don't alert on filings older than this. The hourly poll detects genuinely
// new filings within ~an hour, so a "new to us" filing that's already several
// days old means the cron was down for a stretch — we advance the marker but
// suppress the (stale) email rather than blast late news. Also belt-and-braces
// against a cold start landing mid-filing-season.
const ALERT_FILING_MAX_AGE_DAYS = 4;

// Per-user-per-filing de-dup TTL. Quarterly cadence means 90 days comfortably
// covers "already emailed this filing" without growing KV unbounded.
const PER_USER_DEDUP_TTL_SECONDS = 90 * 24 * 60 * 60;

// Curated CIK → display name (nicer than EDGAR's ALL-CAPS legal name).
const DISPLAY_NAME_BY_CIK = new Map(
  MARQUEE_FUNDS.map((f) => [f.cik, f.displayName]),
);

// Lazily construct the Resend client. Module-scope `new Resend(key)` throws
// "Missing API key" at import time, which crashes `next build`'s page-data
// collection (the route gets imported even though it never runs at build).
// Constructing on first use inside the handler defers that to request time,
// where the env var is present. Returns null if the key is unset so the
// handler can respond gracefully instead of 500-ing.
let _resend: Resend | null = null;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!_resend) _resend = new Resend(key);
  return _resend;
}
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ?? "alerts@13f.mapperlab.co";
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://13f.mapperlab.co";

// ---------------------------------------------------------------------------
// Secret header guard — prevents unauthorized cron triggers.
// Set CRON_SECRET env var on Vercel; Vercel's own cron runner sends it
// automatically via the "Authorization: Bearer <secret>" header when you
// configure it in vercel.json.
// ---------------------------------------------------------------------------
function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // If the secret isn't configured, allow ONLY in non-production (local dev).
  // In production an unset secret must FAIL CLOSED — otherwise this endpoint
  // becomes a public trigger for the entire mass-email loop once Resend is
  // configured. Set CRON_SECRET in Vercel before relying on the cron.
  if (!cronSecret) return process.env.NODE_ENV !== "production";

  // Vercel cron sends: Authorization: Bearer <secret>
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;

  // Also accept a custom header for manual triggers
  const customHeader = req.headers.get("x-cron-secret");
  if (customHeader === cronSecret) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Compute the one-click unsubscribe token for {userId, cik}.
// HMAC-SHA256 over "userId:cik" using CRON_SECRET, base64url-encoded.
// NOTE: CRON_SECRET reuse is provisional — once we add a dedicated
// UNSUBSCRIBE_SECRET we should rotate this off the cron key.
// ---------------------------------------------------------------------------
function buildUnsubscribeToken(userId: string, cik: string): string {
  const secret = process.env.CRON_SECRET ?? "";
  return crypto
    .createHmac("sha256", secret)
    .update(`${userId}:${cik}`)
    .digest("base64url");
}

// ---------------------------------------------------------------------------
// Build the alert email HTML.
// ---------------------------------------------------------------------------
function buildEmailHtml(
  fundName: string,
  cik: string,
  moves: MaterialMove[],
  filingDate: string,
  unsubscribeToken: string,
): string {
  const fundUrl = `${BASE_URL}/fund/${cik}`;
  const unsubscribeUrl = `${BASE_URL}/api/alerts/unsubscribe?token=${unsubscribeToken}`;

  const typeLabel: Record<MaterialMove["changeType"], string> = {
    new: "New position",
    exit: "Full exit",
    add: "Added",
  };

  const typeColor: Record<MaterialMove["changeType"], string> = {
    new: "#22c55e",
    exit: "#ef4444",
    add: "#3b82f6",
  };

  const rows = moves
    .map(
      (m) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600">${m.ticker}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px">${m.issuer}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">
        <span style="background:${typeColor[m.changeType]}22;color:${typeColor[m.changeType]};padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">
          ${typeLabel[m.changeType]}
        </span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-variant-numeric:tabular-nums">
        $${(m.valueUsd / 1_000_000).toFixed(1)}M
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-variant-numeric:tabular-nums;color:#6b7280">
        ${m.changePercent != null ? `${m.changePercent >= 0 ? "+" : ""}${m.changePercent.toFixed(1)}%` : "—"}
      </td>
    </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:680px;margin:40px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">

    <!-- Header -->
    <div style="background:#0a0a0a;padding:24px 32px">
      <div style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#6b7280;margin-bottom:4px">13F Platform · Alert</div>
      <div style="font-size:22px;font-weight:700;color:#ffffff">${fundName}</div>
      <div style="font-size:13px;color:#9ca3af;margin-top:4px">New 13F filing · ${filingDate}</div>
    </div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="margin:0 0 20px;color:#374151;line-height:1.6">
        <strong>${fundName}</strong> filed a new 13F on <strong>${filingDate}</strong>.
        We detected <strong>${moves.length} material move${moves.length !== 1 ? "s" : ""}</strong>
        (positions ≥$50M: new entries, full exits, or material adds).
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600">Ticker</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600">Issuer</th>
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600">Change</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600">Value</th>
            <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600">Δ%</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="margin-top:24px">
        <a href="${fundUrl}"
           style="display:inline-block;background:#0a0a0a;color:#ffffff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">
          View full portfolio →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
        You're receiving this because you watched <strong>${fundName}</strong> on
        <a href="${BASE_URL}" style="color:#6b7280">13F Platform</a>.
        <a href="${unsubscribeUrl}" style="color:#6b7280">Unsubscribe from ${fundName} alerts</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

type Subscriber = { userId: string; email: string };
type ResultRow = {
  cik: string;
  userId?: string;
  status: "filing" | "sent" | "skipped" | "error";
  reason?: string;
};

// Scan every KV key matching a pattern (cursor-paged).
async function scanKeys(match: string): Promise<string[]> {
  let cursor = 0;
  const keys: string[] = [];
  do {
    const [next, batch] = await kv.scan(cursor, { match, count: 100 });
    cursor = next as unknown as number;
    keys.push(...(batch as string[]));
  } while (cursor !== 0);
  return keys;
}

// Build cik → subscribers from all alerts:subscriptions:* sets, so we do the
// (rate-limited) EDGAR work ONCE per fund and fan the result out to everyone
// watching it, rather than re-fetching per user.
async function loadSubscribersByCik(): Promise<Map<string, Subscriber[]>> {
  const subKeys = await scanKeys("alerts:subscriptions:*");
  const byCik = new Map<string, Subscriber[]>();
  for (const key of subKeys) {
    const userId = key.replace("alerts:subscriptions:", "");
    const [ciks, email] = await Promise.all([
      kv.smembers(key) as Promise<string[]>,
      kv.get<string>(`alerts:email:${userId}`),
    ]);
    if (!email || !ciks || ciks.length === 0) continue;
    for (const raw of ciks) {
      const cik = raw.replace(/^0+/, "");
      const arr = byCik.get(cik) ?? [];
      arr.push({ userId, email });
      byCik.set(cik, arr);
    }
  }
  return byCik;
}

// ---------------------------------------------------------------------------
// Process a single fund: poll EDGAR for its latest 13F, and if that filing is
// new since we last looked (and genuinely fresh), diff it against the prior
// quarter and email every subscriber.
//
// De-dup is two-tiered:
//   • alerts:filing-seen:{cik}              → accession we last processed. The
//     hourly run is a no-op until this changes. Seeded silently on first sight
//     of a fund so we never alert on filings that predate the subscription.
//   • alerts:last-sent:{userId}:{cik}:{acc} → per-user guard so a partially
//     failed run doesn't double-send on retry.
// ---------------------------------------------------------------------------
async function processFund(
  cik: string,
  subs: Subscriber[],
  resend: Resend,
  results: ResultRow[],
): Promise<void> {
  const seenKey = `alerts:filing-seen:${cik}`;

  const info = await getFundInfo(cik, "recent");
  const filings = info.filings;
  if (filings.length === 0) {
    results.push({ cik, status: "skipped", reason: "no 13F filings" });
    return;
  }

  // "Latest" = most recently FILED 13F (by filingDate, accession as tiebreak),
  // so a fresh amendment of an earlier quarter still registers as a new event.
  const latest = [...filings].sort(
    (a, b) =>
      b.filingDate.localeCompare(a.filingDate) ||
      b.accessionNumber.localeCompare(a.accessionNumber),
  )[0];

  const seen = await kv.get<string>(seenKey);

  // Steady state — nothing new since last hour. This is the common path.
  if (seen === latest.accessionNumber) {
    results.push({ cik, status: "skipped", reason: "no new filing" });
    return;
  }

  // First time we've ever polled this fund → seed the marker silently. Without
  // this, the first run would alert on whatever the fund last filed (possibly
  // weeks ago). Subscribers get FUTURE filings, not back-history.
  if (seen == null) {
    await kv.set(seenKey, latest.accessionNumber);
    results.push({ cik, status: "skipped", reason: "seeded (first run)" });
    return;
  }

  // New accession. Suppress stale catch-up (e.g. cron outage): advance the
  // marker but don't email if the filing is already older than the window.
  const ageDays =
    (Date.now() - new Date(latest.filingDate).getTime()) / 86_400_000;
  if (ageDays > ALERT_FILING_MAX_AGE_DAYS) {
    await kv.set(seenKey, latest.accessionNumber);
    results.push({
      cik,
      status: "skipped",
      reason: `new filing ${latest.filingDate} is ${ageDays.toFixed(1)}d old (stale)`,
    });
    return;
  }

  const fundName = DISPLAY_NAME_BY_CIK.get(cik) || info.name || `CIK ${cik}`;

  // Diff the latest quarter against the most recent EARLIER quarter (skip
  // same-period amendments so we compare period-over-period, not vs a restated
  // copy of the same quarter).
  const prior =
    filings
      .filter((f) => f.reportDate < latest.reportDate)
      .sort((a, b) => b.reportDate.localeCompare(a.reportDate))[0] ?? null;

  const [latestHoldings, priorHoldings] = await Promise.all([
    getHoldings(cik, latest.accessionNumber, latest.filingDate),
    prior
      ? getHoldings(cik, prior.accessionNumber, prior.filingDate)
      : Promise.resolve<Holding[]>([]),
  ]);

  const moves = detectMaterialMovesFromHoldings(latestHoldings, priorHoldings, {
    cik,
    fundName,
    filingDate: latest.filingDate,
  });

  if (moves.length === 0) {
    await kv.set(seenKey, latest.accessionNumber);
    results.push({ cik, status: "skipped", reason: "new filing, no material moves" });
    return;
  }

  results.push({
    cik,
    status: "filing",
    reason: `${moves.length} material move(s) in ${latest.accessionNumber} (${latest.filingDate})`,
  });

  // Fan out to subscribers. One bad address doesn't abort the rest.
  for (const { userId, email } of subs) {
    const dedupKey = `alerts:last-sent:${userId}:${cik}:${latest.accessionNumber}`;
    if (await kv.get(dedupKey)) {
      results.push({ cik, userId, status: "skipped", reason: "already sent this filing" });
      continue;
    }
    try {
      const token = buildUnsubscribeToken(userId, cik);
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: `[13F Alert] ${fundName} filed new moves (${latest.filingDate})`,
        html: buildEmailHtml(fundName, cik, moves, latest.filingDate, token),
      });
      await kv.set(dedupKey, latest.filingDate, { ex: PER_USER_DEDUP_TTL_SECONDS });
      results.push({ cik, userId, status: "sent" });
    } catch (err) {
      results.push({
        cik,
        userId,
        status: "error",
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Advance the per-fund marker so next hour is a no-op until the NEXT filing.
  // Per-user dedup keys above protect against double-sends if this run was
  // partial when it errored.
  await kv.set(seenKey, latest.accessionNumber);
}

// ---------------------------------------------------------------------------
// POST /api/alerts/send
// Called hourly by the Vercel cron (or manually). Polls EDGAR live for every
// subscribed fund and emails subscribers within ~an hour of a new 13F filing.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json(
      { error: "Email not configured — RESEND_API_KEY is unset." },
      { status: 503 },
    );
  }

  const results: ResultRow[] = [];
  const subscribersByCik = await loadSubscribersByCik();

  // Process funds sequentially — getFundInfo/getHoldings already share a
  // process-wide ~9.5 req/s SEC rate limiter, so parallelizing here wouldn't
  // go faster and only risks tripping 429s.
  for (const [cik, subs] of subscribersByCik) {
    try {
      await processFund(cik, subs, resend, results);
    } catch (err) {
      results.push({
        cik,
        status: "error",
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const tally = (s: ResultRow["status"]) =>
    results.filter((r) => r.status === s).length;

  return NextResponse.json({
    ok: true,
    summary: {
      fundsPolled: subscribersByCik.size,
      newFilings: tally("filing"),
      sent: tally("sent"),
      skipped: tally("skipped"),
      errors: tally("error"),
    },
    results,
  });
}

// ---------------------------------------------------------------------------
// GET /api/alerts/send
// Vercel cron sends GET by default — alias to POST so the cron triggers the run.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
