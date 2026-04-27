import { NextResponse } from "next/server";
import { getDb, getLastSyncAt, getMetrics } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    getDb();
    const m = getMetrics();
    const lastSyncAt = getLastSyncAt();
    return NextResponse.json({ ...m, lastSyncAt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
