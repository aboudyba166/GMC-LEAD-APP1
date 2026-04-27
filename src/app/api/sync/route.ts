import { NextRequest, NextResponse } from "next/server";
import { fetchFromConfigurations } from "@/lib/google-sheets";
import { getDb, runSyncIngestion } from "@/lib/db";
import { tryParseSheetConfiguration, type SheetConfiguration } from "@/lib/sheet-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    getDb();
    let body: { configurations?: unknown } = {};
    try {
      body = (await req.json()) as { configurations?: unknown };
    } catch {
      body = {};
    }
    const raw = body.configurations;
    const configurations = Array.isArray(raw)
      ? raw.map(tryParseSheetConfiguration).filter((x): x is SheetConfiguration => x !== null)
      : [];

    if (configurations.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Add at least one sheet configuration in the Admin dashboard and sync from there (configurations are sent with the request).",
        },
        { status: 400 }
      );
    }

    const rows = await fetchFromConfigurations(configurations);
    const result = runSyncIngestion(
      rows.map((r) => ({
        lead: r.lead,
        sourceId: r.sourceId,
        initialStatus: r.initialStatus,
        sheetRow: r.sheetRow,
      })),
      !!(body as any).isAutoSync
    );
    return NextResponse.json({
      ok: true,
      inserted: result.inserted,
      merged: result.merged,
      duplicatesPrevented: result.duplicatesPrevented,
      lastSyncAt: result.at,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
