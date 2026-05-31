import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// One-click unsubscribe (RFC 8058-ish). The link in each digest email is a
// signed URL of the form
//   /api/alerts/unsubscribe?token=<base64url(HMAC-SHA256(userId+":"+cik))>
// On valid token we drop the cik from the user's alerts subscription set
// and render a confirmation page. Constant-time comparison guards against
// timing oracles.
//
// NOTE: We currently reuse CRON_SECRET as the HMAC key. This is provisional —
// the cron key and the unsubscribe key should be split (UNSUBSCRIBE_SECRET)
// once we set up the proper secret. See Phase 0.5 remediation notes.
// ---------------------------------------------------------------------------

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://13f.mapperlab.co";

function computeToken(userId: string, cik: string): string {
  const secret = process.env.CRON_SECRET ?? "";
  return crypto
    .createHmac("sha256", secret)
    .update(`${userId}:${cik}`)
    .digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// Find the (userId, cik) pair whose HMAC matches the token. We scan all
// subscription sets — the token space is large enough that brute-force
// reversal isn't tractable, but we still want O(N) over current subscribers,
// not random guessing. Small N in practice (one set per user).
async function resolveToken(
  token: string,
): Promise<{ userId: string; cik: string } | null> {
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

  for (const key of subKeys) {
    const userId = key.replace("alerts:subscriptions:", "");
    const ciks = (await kv.smembers(key)) as string[];
    for (const cik of ciks) {
      const expected = computeToken(userId, cik);
      if (safeEqual(token, expected)) return { userId, cik };
    }
  }
  return null;
}

function renderUnsubscribedPage(cik: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribed · 13F</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #0a0a0a; color: #f5f5f5; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: flex; align-items: center; justify-content: center; }
    .card { max-width: 520px; padding: 48px 40px; text-align: left; }
    .brand { font-family: "Instrument Serif", Georgia, serif; font-size: 32px; letter-spacing: -0.01em; margin-bottom: 32px; }
    .brand .dot { color: #f59e0b; }
    h1 { font-family: "Instrument Serif", Georgia, serif; font-weight: 400; font-size: 28px; line-height: 1.25; margin: 0 0 12px; }
    p { color: #a3a3a3; line-height: 1.6; font-size: 14px; margin: 0 0 24px; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #d4d4d4; background: #1a1a1a; padding: 1px 6px; border-radius: 3px; font-size: 13px; }
    a.back { display: inline-block; color: #f5f5f5; border: 1px solid #2a2a2a; padding: 10px 18px; text-decoration: none; font-size: 13px; border-radius: 4px; }
    a.back:hover { background: #1a1a1a; }
  </style>
</head>
<body>
  <div class="card">
    <div class="brand">13F<span class="dot">.</span></div>
    <h1>Unsubscribed.</h1>
    <p>You'll no longer receive alerts for <code>CIK ${cik}</code>. You can resubscribe at any time from your watchlist.</p>
    <a class="back" href="${BASE_URL}/watchlist">Back to watchlist</a>
  </div>
</body>
</html>`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json(
      { error: "Missing token query param" },
      { status: 400 },
    );
  }

  // Token shape: base64url of 32 raw bytes → 43 chars. Reject anything
  // implausible so we don't waste a KV scan on garbage input.
  if (token.length < 16 || token.length > 256 || !/^[A-Za-z0-9_-]+$/.test(token)) {
    return NextResponse.json(
      { error: "Invalid token" },
      { status: 400 },
    );
  }

  const resolved = await resolveToken(token);
  if (!resolved) {
    return NextResponse.json(
      { error: "Invalid or expired token" },
      { status: 400 },
    );
  }

  await kv.srem(`alerts:subscriptions:${resolved.userId}`, resolved.cik);

  return new NextResponse(renderUnsubscribedPage(resolved.cik), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
