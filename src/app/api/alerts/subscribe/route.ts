import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { kv } from "@vercel/kv";

export const dynamic = "force-dynamic";

// KV schema:
//   alerts:subscriptions:{userId}  → Redis Set of CIK strings
//   alerts:email:{userId}          → string (user's alert email)

function subsKey(userId: string): string {
  return `alerts:subscriptions:${userId}`;
}

function emailKey(userId: string): string {
  return `alerts:email:${userId}`;
}

// ---------------------------------------------------------------------------
// GET /api/alerts/subscribe
// Returns { ciks: string[], email: string | null }
// ---------------------------------------------------------------------------
export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [ciks, email] = await Promise.all([
    kv.smembers(subsKey(userId)) as Promise<string[]>,
    kv.get<string>(emailKey(userId)),
  ]);

  return NextResponse.json({ ciks: (ciks ?? []).sort(), email: email ?? null });
}

// ---------------------------------------------------------------------------
// POST /api/alerts/subscribe  { cik: string, email: string }
// Subscribes the user to alerts for the given CIK.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).cik !== "string" ||
    typeof (body as Record<string, unknown>).email !== "string"
  ) {
    return NextResponse.json(
      { error: "Body must contain { cik: string, email: string }" },
      { status: 400 },
    );
  }

  const { cik, email } = body as { cik: string; email: string };

  if (!email.includes("@")) {
    return NextResponse.json(
      { error: "Invalid email address" },
      { status: 400 },
    );
  }

  await Promise.all([
    kv.sadd(subsKey(userId), cik),
    kv.set(emailKey(userId), email),
  ]);

  return NextResponse.json({ ok: true, cik, email });
}

// ---------------------------------------------------------------------------
// DELETE /api/alerts/subscribe  { cik: string }
// Unsubscribes the user from alerts for the given CIK.
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    typeof (body as Record<string, unknown>).cik !== "string"
  ) {
    return NextResponse.json(
      { error: "Body must contain { cik: string }" },
      { status: 400 },
    );
  }

  const { cik } = body as { cik: string };

  await kv.srem(subsKey(userId), cik);

  return NextResponse.json({ ok: true, cik });
}
