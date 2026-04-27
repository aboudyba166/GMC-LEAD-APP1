import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const db = getDb();
    
    // Delete all leads
    db.prepare("DELETE FROM leads").run();
    
    // Reset the duplicates prevented counter
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
      .run("duplicates_prevented_total", "0");
      
    // Reset last sync time
    db.prepare("DELETE FROM settings WHERE key = 'last_sync_at'").run();

    return NextResponse.json({ ok: true, message: "Database cleaned successfully" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
