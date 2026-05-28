import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { kv } from "@vercel/kv";

export const dynamic = "force-dynamic";

// KV key pattern: watchlist:{userId}:{kind}  →  Redis Set
//   kind "fund"  → watchlist:{userId}:funds
//   kind "stock" → watchlist:{userId}:stocks

function kvKey(userId: string, kind: "fund" | "stock"): string {
  return `watchlist:${userId}:${kind === "fund" ? "funds" : "stocks"}`;
}

function isValidKind(kind: unknown): kind is "fund" | "stock" {
  return kind === "fund" || kind === "stock";
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

  const key = kvKey(userId, body.kind);
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
