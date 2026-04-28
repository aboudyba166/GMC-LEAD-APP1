"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Lock, UserCheck, MessageSquarePlus, MessageCircle, Clock } from "lucide-react";
import { LeadStatusSelect } from "./lead-status-select";
import { cn } from "@/lib/utils";
import { isoToLocalDatetimeValue, localDatetimeValueToIso } from "@/lib/datetime-input";
import { LEAD_STATUS, isBookedStatus, needsFollowUpFields, needsLostReasonFields, type LeadStatus } from "@/lib/lead-status";
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
  currentAgent?: string;
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

export function LeadRow({ lead, onUpdate, onCopy, copyId, currentAgent }: Props) {
  const booked = isBookedStatus(lead.status);
  const inProgress = lead.status === LEAD_STATUS.IN_PROGRESS;
  const isNew = lead.status === LEAD_STATUS.NEW_LEAD;
  
  // Response Timer Logic
  const [timeElapsed, setTimeElapsed] = useState<string>("");
  const [timerColor, setTimeColor] = useState<string>("text-zinc-400");

  useEffect(() => {
    if (!isNew || !!lead.firstActionAt) {
      setTimeElapsed("");
      return;
    }

    const updateTimer = () => {
      // Only run timer if createdAt is a valid ISO string (contains 'T')
      if (!lead.createdAt || !lead.createdAt.includes("T")) {
        setTimeElapsed("");
        return;
      }
      
      const start = new Date(lead.createdAt).getTime();
      const now = new Date().getTime();
      const diff = Math.floor((now - start) / 1000); // seconds

      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      
      if (mins < 15) setTimeColor("text-emerald-500 font-bold");
      else if (mins < 60) setTimeColor("text-amber-500 font-bold");
      else setTimeColor("text-rose-500 font-bold animate-pulse");

      setTimeElapsed(`${mins}m ${secs}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [isNew, lead.createdAt, lead.firstActionAt]);

  // Check if follow-up is due today or overdue
  const isFollowUpDue = lead.followUpAt && new Date(lead.followUpAt) <= new Date();

  const [localFollowAt, setLocalFollowAt] = useState(isoToLocalDatetimeValue(lead.followUpAt));
  const [localFollowNote, setLocalFollowNote] = useState(lead.followUpNote ?? "");
  const [localLost, setLocalLost] = useState(lead.lostReason ?? "");
  const [localActionCall, setLocalActionCall] = useState(lead.actionCall ?? "");
  const [localNote, setLocalNote] = useState(lead.notes ?? "");
  const followDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalFollowAt(isoToLocalDatetimeValue(lead.followUpAt));
    setLocalFollowNote(lead.followUpNote ?? "");
    setLocalLost(lead.lostReason ?? "");
    setLocalActionCall(lead.actionCall ?? "");
    setLocalNote(lead.notes ?? "");
  }, [lead]);

  useEffect(() => {
    return () => {
      if (followDebounce.current) clearTimeout(followDebounce.current);
    };
  }, []);

  async function setStatus(s: LeadStatus) {
    const patch: Record<string, any> = { status: s };
    
    // Auto-set follow-up date to 24h from now for specific statuses
    if (s === LEAD_STATUS.WILL_CALL_BACK || s === LEAD_STATUS.NO_ANSWER) {
      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 24);
      patch.followUpAt = tomorrow.toISOString();
    }
    
    await onUpdate(lead.id, patch);
  }

  async function claimLead() {
    if (!currentAgent) {
      alert("Please set your agent name in the header first!");
      return;
    }
    await onUpdate(lead.id, { 
      status: LEAD_STATUS.IN_PROGRESS, 
      assignedTo: currentAgent,
      lastActionAt: new Date().toISOString()
    });
  }

  const openWhatsAppTemplate = () => {
    if (!lead.phoneNumber) return;
    const message = encodeURIComponent("مرحباً، نحن نتواصل معك من مجمع جاردينيا الطبي (Gardenia Medical Complex) بخصوص طلبك. كيف يمكننا مساعدتك اليوم؟");
    const phone = lead.phoneNumber.replace(/\D/g, "");
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  };

  const handleQuickAction = async (action: 'no_answer' | 'busy' | 'interested') => {
    const patch: Record<string, any> = {};
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    if (action === 'no_answer') {
      patch.status = LEAD_STATUS.NO_ANSWER;
      patch.followUpAt = tomorrow.toISOString();
      patch.actionCall = "No Answer - Sent WA";
      openWhatsAppTemplate();
    } else if (action === 'busy') {
      patch.status = LEAD_STATUS.WILL_CALL_BACK;
      patch.followUpAt = tomorrow.toISOString();
      patch.actionCall = "Customer Busy";
    } else if (action === 'interested') {
      patch.status = LEAD_STATUS.INQUIRY;
      patch.actionCall = "Interested - Discussing";
    }

    await onUpdate(lead.id, patch);
  };

  return (
    <tr
      className={cn(
        "border-b border-zinc-100 transition-colors dark:border-zinc-800/80",
        booked && "bg-emerald-50/50 opacity-[0.88] dark:bg-emerald-950/20 dark:opacity-90",
        inProgress && "bg-sky-50/40 dark:bg-sky-950/10",
        isFollowUpDue && !booked && "bg-amber-50/60 dark:bg-amber-950/10 border-l-4 border-l-amber-500"
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
        <div className="flex flex-col">
          <span>{lead.fullName || "—"}</span>
          {timeElapsed && (
            <span className={cn("inline-flex items-center gap-1 text-[9px] uppercase tracking-wider", timerColor)}>
              <Clock className="h-2.5 w-2.5" />
              {timeElapsed}
            </span>
          )}
        </div>
        {booked && (
          <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
            <Lock className="h-3 w-3" /> Booked
          </span>
        )}
        {inProgress && (
          <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-sky-600 dark:text-sky-400">
            <UserCheck className="h-3 w-3" /> In Progress
          </span>
        )}
        {isFollowUpDue && !booked && (
          <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-bold">
            ⚠️ Due
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
            {isNew ? (
              <button
                type="button"
                onClick={() => void claimLead()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-500 dark:bg-sky-500 dark:hover:bg-sky-400"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Claim Lead
              </button>
            ) : inProgress ? (
              <div className="flex gap-1">
                <button
                  onClick={() => void handleQuickAction('no_answer')}
                  className="rounded bg-rose-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-rose-600"
                >
                  No Ans
                </button>
                <button
                  onClick={() => void handleQuickAction('busy')}
                  className="rounded bg-amber-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-amber-600"
                >
                  Busy
                </button>
                <button
                  onClick={() => void handleQuickAction('interested')}
                  className="rounded bg-emerald-500 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-600"
                >
                  Int.
                </button>
              </div>
            ) : (
              <LeadStatusSelect
                value={lead.status}
                onChange={(v) => void setStatus(v)}
                disabled={booked}
                aria-label={`Status for ${lead.fullName || lead.id}`}
              />
            )}
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
                className={cn(
                  "w-full max-w-[200px] rounded border px-1.5 py-1 text-[11px]",
                  isFollowUpDue ? "border-amber-400 bg-amber-100 dark:bg-amber-900/40" : "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30"
                )}
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
          {inProgress && (
            <div className="flex flex-1 flex-col gap-1">
              <textarea
                value={localNote}
                onChange={(e) => setLocalNote(e.target.value)}
                onBlur={() => void onUpdate(lead.id, { notes: localNote || null })}
                placeholder="Call notes..."
                rows={2}
                className="w-full max-w-xs rounded border border-sky-200 bg-white px-1.5 py-1 text-[11px] dark:border-sky-800 dark:bg-zinc-900"
              />
            </div>
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
      <td className="px-1 py-1 text-center">
        <div className="flex flex-col gap-1">
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
          <div className="flex gap-1">
            {lead.phoneNumber && (
              <a
                href={`https://wa.me/${lead.phoneNumber.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Direct WhatsApp"
                className="flex-1 inline-flex items-center justify-center rounded bg-emerald-500 px-1 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-600"
              >
                <MessageSquarePlus className="h-3 w-3" />
              </a>
            )}
            {lead.phoneNumber && (
              <button
                type="button"
                onClick={openWhatsAppTemplate}
                title="WhatsApp Arabic Template"
                className="flex-1 inline-flex items-center justify-center rounded bg-sky-500 px-1 py-0.5 text-[10px] font-bold text-white hover:bg-sky-600"
              >
                <MessageCircle className="h-3 w-3" />
                AR
              </button>
            )}
          </div>
        </div>
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
        <div className="flex flex-col">
          <span className={cn(lead.createdAt && "text-sky-600 font-bold dark:text-sky-400")}>
            {lead.createdAt || "—"}
          </span>
          {lead.lastActionAt && (
            <span className="text-[9px] text-zinc-400 italic">
              Acted: {fmtShort(lead.lastActionAt)}
            </span>
          )}
        </div>
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
            "dark:border-zinc-600 dark:bg-zinc-800",
            lead.assignedTo && "font-semibold text-sky-700 dark:text-sky-400"
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
