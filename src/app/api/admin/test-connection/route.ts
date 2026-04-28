import { NextRequest, NextResponse } from "next/server";
import { fetchFromConfigurations } from "@/lib/google-sheets";
import { tryParseSheetConfiguration } from "@/lib/sheet-config";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const config = tryParseSheetConfiguration(body.config);

    if (!config) {
      return NextResponse.json({ ok: false, error: "Invalid configuration format" }, { status: 400 });
    }

    // Attempt to fetch just this one configuration
    const results = await fetchFromConfigurations([config]);
    
    return NextResponse.json({ 
      ok: true, 
      count: results.length,
      message: `Successfully connected! Found ${results.length} leads.`
    });
  } catch (e) {
    console.error("Connection test failed:", e);
    return NextResponse.json({ 
      ok: false, 
      error: e instanceof Error ? e.message : String(e) 
    }, { status: 200 }); // Return 200 so we can show the error message nicely in the UI
  }
}
