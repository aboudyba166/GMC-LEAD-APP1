import { NextRequest, NextResponse } from "next/server";
import { getLeadById, updateLead, type LeadPatch } from "@/lib/db";
import { isLeadStatus } from "@/lib/lead-status";
import type { YesNo } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isYesNo(x: string): x is YesNo {
  return x === "yes" || x === "no" || x === "";
}

function validatePatch(body: Record<string, unknown>): LeadPatch | { error: string } {
  const p: LeadPatch = {};
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !isLeadStatus(body.status)) {
      return { error: "Invalid status" };
    }
    p.status = body.status;
  }
  if (body.assignedTo !== undefined) {
    p.assignedTo = typeof body.assignedTo === "string" ? body.assignedTo : "";
  }
  if (body.followUpAt !== undefined) {
    p.followUpAt =
      body.followUpAt === null
        ? null
        : typeof body.followUpAt === "string"
          ? body.followUpAt
          : null;
  }
  if (body.followUpNote !== undefined) {
    p.followUpNote = typeof body.followUpNote === "string" ? body.followUpNote : null;
  }
  if (body.lostReason !== undefined) {
    p.lostReason = typeof body.lostReason === "string" ? body.lostReason : null;
  }
  if (body.actionCall !== undefined) {
    p.actionCall = typeof body.actionCall === "string" ? body.actionCall : "";
  }
  if (body.whatsappSent !== undefined) {
    if (typeof body.whatsappSent !== "string" || !isYesNo(body.whatsappSent)) {
      return { error: "Invalid whatsappSent" };
    }
    p.whatsappSent = body.whatsappSent;
  }
  if (body.reminderSent !== undefined) {
    if (typeof body.reminderSent !== "string" || !isYesNo(body.reminderSent)) {
      return { error: "Invalid reminderSent" };
    }
    p.reminderSent = body.reminderSent;
  }
  if (
    p.status === undefined &&
    p.assignedTo === undefined &&
    p.followUpAt === undefined &&
    p.followUpNote === undefined &&
    p.lostReason === undefined &&
    p.actionCall === undefined &&
    p.whatsappSent === undefined &&
    p.reminderSent === undefined
  ) {
    return { error: "No valid fields" };
  }
  return p;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const raw = (await req.json()) as Record<string, unknown>;
    const parsed = validatePatch(raw);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const r = updateLead(id, parsed);
    if (!r.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const lead = getLeadById(id);
    return NextResponse.json({ ok: true, lead });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const lead = getLeadById(id);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(lead);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
