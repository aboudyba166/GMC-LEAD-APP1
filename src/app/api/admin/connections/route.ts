import { NextRequest, NextResponse } from "next/server";
import { getDb, listSheetConnections, saveSheetConnection, deleteSheetConnection } from "@/lib/db";
import { tryParseSheetConfiguration, type SheetConfiguration } from "@/lib/sheet-config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connections = listSheetConnections();
    return NextResponse.json({ ok: true, connections });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const configs = body.configs;
    
    if (!Array.isArray(configs)) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const parsedConfigs = configs
      .map(tryParseSheetConfiguration)
      .filter((c): c is SheetConfiguration => c !== null);

    // Get current IDs to handle deletions
    const current = listSheetConnections();
    const currentIds = new Set(current.map(c => c.id));
    const newIds = new Set(parsedConfigs.map(c => c.id));

    // Save/Update new ones
    for (const config of parsedConfigs) {
      saveSheetConnection(config);
    }

    // Delete removed ones
    for (const id of currentIds) {
      if (!newIds.has(id)) {
        deleteSheetConnection(id);
      }
    }

    return NextResponse.json({ ok: true, connections: listSheetConnections() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
