"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Lock } from "lucide-react";
import { LeadStatusSelect } from "./lead-status-select";
import { cn } from "@/lib/utils";
import { isoToLocalDatetimeValue, localDatetimeValueToIso } from "@/lib/datetime-input";
import { isBookedStatus, needsFollowUpFields, needsLostReasonFields, type LeadStatus } from "@/lib/lead-status";
import type { LeadRecord, YesNo } from "@/lib/types";

const AGENT_PLACEHOLDERS = [
  "—",
  "Alex M.",
  "Sam R.",
  "Jordan K.",
  "Priya S.",
  "Unassigned",
];

const YES_NO: { value: YesNo; label: string }[] = [
  { value: "", label: "—" },
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

type Props = {
  lead: LeadRecord;
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<LeadRecord | null>;
  onCopy: (phone: string, id: string) => void;
  copyId: string | null;
};

function fmtShort(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export function LeadRow({ lead, onUpdate, onCopy, copyId }: Props) {
  const booked = isBookedStatus(lead.status);
  const [localFollowAt, setLocalFollowAt] = useState(isoToLocalDatetimeValue(lead.followUpAt));
  const [localFollowNote, setLocalFollowNote] = useState(lead.followUpNote ?? "");
  const [localLost, setLocalLost] = useState(lead.lostReason ?? "");
  const [localActionCall, setLocalActionCall] = useState(lead.actionCall ?? "");
  const followDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalFollowAt(isoToLocalDatetimeValue(lead.followUpAt));
    setLocalFollowNote(lead.followUpNote ?? "");
    setLocalLost(lead.lostReason ?? "");
    setLocalActionCall(lead.actionCall ?? "");
  }, [lead]);

  useEffect(() => {
    return () => {
      if (followDebounce.current) clearTimeout(followDebounce.current);
    };
  }, []);

  async function setStatus(s: LeadStatus) {
    await onUpdate(lead.id, { status: s });
  }

  return (
    <tr
      className={cn(
        "border-b border-zinc-100 dark:border-zinc-800/80",
        booked && "bg-emerald-50/50 opacity-[0.88] dark:bg-emerald-950/20 dark:opacity-90"
      )}
    >
      <td
        className={cn(
          "max-w-[130px] truncate px-2 py-2 text-zinc-700 dark:text-zinc-300",
          booked && "text-zinc-500"
        )}
      >
        {lead.campaignData || "—"}
      </td>
      <td
        className={cn("max-w-[100px] truncate px-2 py-2 text-sm font-medium", booked && "text-zinc-500")}
      >
        {lead.fullName || "—"}
        {booked && (
          <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
            <Lock className="h-3 w-3" /> Booked
          </span>
        )}
      </td>
      <td
        className={cn(
          "whitespace-nowrap px-2 py-2 font-mono text-[11px] text-zinc-800 dark:text-zinc-200",
          booked && "text-zinc-500"
        )}
      >
        {lead.phoneNumber || "—"}
      </td>
      <td className="max-w-[140px] truncate px-2 py-2 text-sm text-zinc-600 dark:text-zinc-400">
        {lead.serviceRequired || "—"}
      </td>
      <td className="min-w-[240px] px-1 py-1 align-top">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-2">
          <div className="shrink-0">
            <LeadStatusSelect
              value={lead.status}
              onChange={(v) => void setStatus(v)}
              disabled={booked}
              aria-label={`Status for ${lead.fullName || lead.id}`}
            />
          </div>
          {needsFollowUpFields(lead.status) && !booked && (
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <input
                type="datetime-local"
                value={localFollowAt}
                onChange={(e) => {
                  setLocalFollowAt(e.target.value);
                  const iso = localDatetimeValueToIso(e.target.value);
                  if (followDebounce.current) clearTimeout(followDebounce.current);
                  followDebounce.current = setTimeout(() => {
                    void onUpdate(lead.id, { followUpAt: iso });
                  }, 600);
                }}
                className="w-full max-w-[200px] rounded border border-amber-200 bg-amber-50/50 px-1.5 py-1 text-[11px] dark:border-amber-800 dark:bg-amber-950/30"
                aria-label="Follow-up time"
              />
              <input
                type="text"
                value={localFollowNote}
                onChange={(e) => setLocalFollowNote(e.target.value)}
                onBlur={() => void onUpdate(lead.id, { followUpNote: localFollowNote || null })}
                placeholder="Follow-up note"
                className="w-full max-w-xs rounded border border-amber-200 bg-white px-1.5 py-1 text-[11px] dark:border-amber-800 dark:bg-zinc-900"
              />
            </div>
          )}
          {needsLostReasonFields(lead.status) && !booked && (
            <input
              type="text"
              value={localLost}
              onChange={(e) => setLocalLost(e.target.value)}
              onBlur={() => void onUpdate(lead.id, { lostReason: localLost || null })}
              placeholder="Reason / note (lost lead)"
              className="w-full min-w-0 max-w-xs rounded border border-rose-200 bg-rose-50/40 px-1.5 py-1 text-[11px] dark:border-rose-900 dark:bg-rose-950/30"
            />
          )}
        </div>
      </td>
      <td className="max-w-[140px] px-1 py-1">
        <input
          type="text"
          value={localActionCall}
          onChange={(e) => setLocalActionCall(e.target.value)}
          onBlur={() => void onUpdate(lead.id, { actionCall: localActionCall })}
          disabled={booked}
          placeholder="e.g. Call"
          className="w-full rounded border border-zinc-200 bg-white px-1.5 py-1 text-[11px] disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800"
          aria-label="First action (call)"
        />
      </td>
      <td className="px-1 py-1">
        <select
          value={lead.whatsappSent}
          onChange={(e) => void onUpdate(lead.id, { whatsappSent: e.target.value as YesNo })}
          disabled={booked}
          className="w-full min-w-[72px] rounded border border-zinc-200 bg-white py-1 text-[11px] disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800"
          aria-label="WhatsApp sent"
        >
          {YES_NO.map((o) => (
            <option key={o.value || "empty"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-1 py-1">
        <select
          value={lead.reminderSent}
          onChange={(e) => void onUpdate(lead.id, { reminderSent: e.target.value as YesNo })}
          disabled={booked}
          className="w-full min-w-[72px] rounded border border-zinc-200 bg-white py-1 text-[11px] disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800"
          aria-label="Reminder sent"
        >
          {YES_NO.map((o) => (
            <option key={`r-${o.value || "empty"}`} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
        {fmtShort(lead.lastUpdatedAt)}
      </td>
      <td className="px-1 py-1">
        <select
          value={lead.assignedTo || "—"}
          onChange={(e) =>
            void onUpdate(lead.id, { assignedTo: e.target.value === "—" ? "" : e.target.value })
          }
          disabled={booked}
          aria-label="Assigned agent"
          className={cn(
            "w-full min-w-[90px] max-w-[120px] rounded-md border border-zinc-200 bg-white px-1.5 py-1 text-[11px]",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "dark:border-zinc-600 dark:bg-zinc-800"
          )}
        >
          {AGENT_PLACEHOLDERS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </td>
      <td className="px-1 py-1">
        <button
          type="button"
          onClick={() => lead.phoneNumber && onCopy(lead.phoneNumber, lead.id)}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          {copyId === lead.id ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          Copy
        </button>
      </td>
    </tr>
  );
}
