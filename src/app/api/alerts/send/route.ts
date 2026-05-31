import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { Resend } from "resend";
import crypto from "crypto";
import { detectMaterialMoves, type MaterialMove } from "@/lib/alerts";
import type { FundBacktest } from "@/lib/backtest";
import { getFundInfo } from "@/lib/edgar";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";
// Allow up to 5 minutes for the digest run (Vercel Pro/hobby capped at 60s,
// but we keep processing as many subs as possible within the limit)
export const maxDuration = 60;

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
const SNAPSHOT_DIR = path.join(process.cwd(), "src", "data", "backtest");

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
// Load a snapshot JSON from disk (works in Node.js route handler).
// ---------------------------------------------------------------------------
function loadSnapshot(cik: string): FundBacktest | null {
  const cleanCik = cik.replace(/^0+/, "");
  const filePath = path.join(SNAPSHOT_DIR, `${cleanCik}.json`);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as FundBacktest;
  } catch {
    return null;
  }
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

// ---------------------------------------------------------------------------
// POST /api/alerts/send
// Called by the Vercel cron or manually. Sends digest emails for all subs
// where the latest filing is recent and hasn't been emailed already.
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

  const results: Array<{
    userId: string;
    cik: string;
    status: "sent" | "skipped" | "error";
    reason?: string;
  }> = [];

  // 1. Scan all alert subscription keys from KV.
  //    Pattern: alerts:subscriptions:* → each is a Set of CIKs.
  let cursor = 0;
  const subKeys: string[] = [];
  do {
    const [nextCursor, keys] = await kv.scan(cursor, {
      match: "alerts:subscriptions:*",
      count: 100,
    });
    cursor = nextCursor as unknown as number;
    subKeys.push(...(keys as string[]));
  } while (cursor !== 0);

  // 2. For each userId, get their CIKs and email, then process.
  for (const key of subKeys) {
    const userId = key.replace("alerts:subscriptions:", "");
    const [ciks, userEmail] = await Promise.all([
      kv.smembers(key) as Promise<string[]>,
      kv.get<string>(`alerts:email:${userId}`),
    ]);

    if (!userEmail || !ciks || ciks.length === 0) continue;

    for (const cik of ciks) {
      const sentKey = `alerts:last-sent:${userId}:${cik}`;

      // 3. Check last-sent guard (TTL-based dedup — 7 days).
      const alreadySent = await kv.get(sentKey);
      if (alreadySent) {
        results.push({ userId, cik, status: "skipped", reason: "already sent within 7 days" });
        continue;
      }

      // 4. Load snapshot.
      const snapshot = loadSnapshot(cik);
      if (!snapshot) {
        results.push({ userId, cik, status: "skipped", reason: "no snapshot" });
        continue;
      }

      // 5. Check that the latest entry is < 7 days old.
      const allDates = Array.from(
        new Set(snapshot.trades.map((t) => t.entryDate)),
      ).sort();
      const latestEntryDate = allDates[allDates.length - 1];
      if (!latestEntryDate) {
        results.push({ userId, cik, status: "skipped", reason: "no filings" });
        continue;
      }

      const daysSinceFiling =
        (Date.now() - new Date(latestEntryDate).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSinceFiling > 7) {
        results.push({
          userId,
          cik,
          status: "skipped",
          reason: `latest filing ${latestEntryDate} is ${daysSinceFiling.toFixed(1)} days old`,
        });
        continue;
      }

      // 5b. Resolve the actual SEC filingDate via EDGAR. Match the filing whose
      // reportDate === latestEntryDate (i.e. treat the snapshot's entryDate
      // as period-end). If the lookup fails — network blip, no matching
      // reportDate, snapshot entryDate already being the filingDate, etc. —
      // fall back to the snapshot entryDate so we still send the email.
      let displayFilingDate = latestEntryDate;
      try {
        const info = await getFundInfo(cik, "recent");
        const match = info.filings.find((f) => f.reportDate === latestEntryDate);
        if (match?.filingDate) displayFilingDate = match.filingDate;
      } catch {
        // network/parse failure → keep displayFilingDate = latestEntryDate
      }

      // 6. Detect material moves.
      const moves = detectMaterialMoves(snapshot);
      if (moves.length === 0) {
        results.push({ userId, cik, status: "skipped", reason: "no material moves" });
        continue;
      }

      // 7. Send email.
      try {
        const unsubscribeToken = buildUnsubscribeToken(userId, cik);
        await resend.emails.send({
          from: FROM_EMAIL,
          to: userEmail,
          subject: `[13F Alert] ${snapshot.fundName} filed new moves (${displayFilingDate})`,
          html: buildEmailHtml(
            snapshot.fundName,
            cik,
            moves,
            displayFilingDate,
            unsubscribeToken,
          ),
        });

        // 8. Set last-sent guard with 7-day TTL (604800 seconds).
        await kv.set(sentKey, latestEntryDate, { ex: 604800 });

        results.push({ userId, cik, status: "sent" });
      } catch (err) {
        results.push({
          userId,
          cik,
          status: "error",
          reason: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({
    ok: true,
    summary: { sent, skipped, errors },
    results,
  });
}

// ---------------------------------------------------------------------------
// GET /api/alerts/send
// Vercel cron sends GET by default — alias to POST so the cron triggers
// the digest run.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
