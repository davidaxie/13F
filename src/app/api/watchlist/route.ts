import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { kv } from "@vercel/kv";
import { MARQUEE_FUNDS } from "@/lib/funds";
import { cusipsForTicker } from "@/lib/cusip-lookup";

export const dynamic = "force-dynamic";

// KV key pattern: watchlist:{userId}:{kind}  →  Redis Set
//   kind "fund"  → watchlist:{userId}:funds
//   kind "stock" → watchlist:{userId}:stocks

// Soft cap to prevent runaway sets (e.g. someone scripting bulk adds).
// Per-user, per-kind. 200 is generous for a research tool.
const MAX_WATCHLIST_SIZE = 200;

function kvKey(userId: string, kind: "fund" | "stock"): string {
  return `watchlist:${userId}:${kind === "fund" ? "funds" : "stocks"}`;
}

function isValidKind(kind: unknown): kind is "fund" | "stock" {
  return kind === "fund" || kind === "stock";
}

// Validate that `id` is recognised for the given `kind`. Returns null on
// success or a human-readable error string on failure.
function validateId(kind: "fund" | "stock", id: string): string | null {
  if (kind === "fund") {
    // Strip leading zeroes to mirror MARQUEE_FUNDS storage.
    const clean = id.replace(/^0+/, "");
    const found = MARQUEE_FUNDS.some((f) => f.cik === clean);
    if (!found) return `CIK ${id} is not in the supported fund universe`;
    return null;
  }
  // kind === "stock" — resolve the ticker through the CUSIP map.
  const cusips = cusipsForTicker(id);
  if (cusips.length === 0) return `Ticker ${id} is not a known stock`;
  return null;
}

// ---------------------------------------------------------------------------
// GET /api/watchlist?kind=fund|stock
// Returns the user's watchlist array for that kind.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kind = req.nextUrl.searchParams.get("kind");
  if (!isValidKind(kind)) {
    return NextResponse.json(
      { error: "Missing or invalid `kind` query param (fund|stock)" },
      { status: 400 },
    );
  }

  const key = kvKey(userId, kind);
  const members: string[] = (await kv.smembers(key)) ?? [];
  return NextResponse.json(members.sort());
}

// ---------------------------------------------------------------------------
// POST /api/watchlist
// Body: { kind: "fund"|"stock", id: string }
// Adds id to the user's watchlist.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !isValidKind(body.kind) || typeof body.id !== "string" || !body.id) {
    return NextResponse.json(
      { error: "Body must be { kind: 'fund'|'stock', id: string }" },
      { status: 400 },
    );
  }

  const validationError = validateId(body.kind, body.id);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 422 });
  }

  const key = kvKey(userId, body.kind);

  // Soft cap — refuse new adds once the user is at MAX_WATCHLIST_SIZE. We
  // check before sadd so a duplicate of an already-watched id doesn't get
  // bounced (it's a no-op on Redis side, but the cap check would still
  // succeed since scard hasn't grown).
  const current = (await kv.scard(key)) ?? 0;
  if (current >= MAX_WATCHLIST_SIZE) {
    return NextResponse.json(
      {
        error: `Watchlist cap reached (${MAX_WATCHLIST_SIZE}). Remove an item first.`,
      },
      { status: 429 },
    );
  }

  await kv.sadd(key, body.id);
  return NextResponse.json({ ok: true, action: "added", id: body.id });
}

// ---------------------------------------------------------------------------
// DELETE /api/watchlist
// Body: { kind: "fund"|"stock", id: string }
// Removes id from the user's watchlist.
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !isValidKind(body.kind) || typeof body.id !== "string" || !body.id) {
    return NextResponse.json(
      { error: "Body must be { kind: 'fund'|'stock', id: string }" },
      { status: 400 },
    );
  }

  const key = kvKey(userId, body.kind);
  await kv.srem(key, body.id);
  return NextResponse.json({ ok: true, action: "removed", id: body.id });
}
