import { NextRequest, NextResponse } from "next/server";
import { getDb, listLeadsPage } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    getDb();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10) || 50));
    const q = searchParams.get("q") || undefined;
    const status = searchParams.get("status") || undefined;
    const bucket = searchParams.get("bucket") || undefined;
    const { items, total } = listLeadsPage({ page, pageSize, q, status, bucket: bucket || undefined });
    return NextResponse.json({ items, total, page, pageSize });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
