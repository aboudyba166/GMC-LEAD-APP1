"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ElementType } from "react";
import {
  BarChart3,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  UserPlus,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { AppNav } from "./app-nav";
import { LeadRow } from "./lead-row";
import { cn } from "@/lib/utils";
import {
  LCC_SHEET_CONFIG_CHANGED_EVENT,
  loadSheetConfigurations,
} from "@/lib/sheet-config-browser";
import type { LeadRecord } from "@/lib/types";
import type { QuickFilterTab } from "@/lib/lead-status";

type Metrics = {
  totalLeads: number;
  newLeadsToday: number;
  duplicatesPrevented: number;
  lastSyncAt: string | null;
};

function looksLikeNoServer(e: unknown): boolean {
  if (!(e instanceof TypeError)) return false;
  return /load failed|fetch|network/i.test(String((e as Error).message));
}

const TABS: { id: QuickFilterTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "follow_up", label: "Follow-up" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
  { id: "invalid", label: "Invalid" },
];

export function LeadCommandCenter() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [bucket, setBucket] = useState<QuickFilterTab>("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [rows, setRows] = useState<LeadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [copyId, setCopyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [hasSavedSheetConnections, setHasSavedSheetConnections] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    function refreshSavedConnections() {
      setHasSavedSheetConnections(loadSheetConfigurations().length > 0);
    }
    refreshSavedConnections();
    window.addEventListener("focus", refreshSavedConnections);
    window.addEventListener("storage", refreshSavedConnections);
    window.addEventListener(LCC_SHEET_CONFIG_CHANGED_EVENT, refreshSavedConnections);
    return () => {
      window.removeEventListener("focus", refreshSavedConnections);
      window.removeEventListener("storage", refreshSavedConnections);
      window.removeEventListener(LCC_SHEET_CONFIG_CHANGED_EVENT, refreshSavedConnections);
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        q: qDebounced,
        bucket,
      });
      const res = await fetch(`/api/leads?${params}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as { items: LeadRecord[]; total: number };
      setRows(data.items);
      setTotal(data.total);
    } catch (e) {
      if (looksLikeNoServer(e)) {
        setBanner(
          "The browser could not reach this app (the Next server or API is down or wrong address). In the web folder run: npm run dev — then use http://localhost:3000 in the same machine’s browser. For another device on the network use: npm run dev:lan and open http://YOUR_PC_IP:3000 (not localhost on the phone)."
        );
      } else {
        setBanner("Could not load leads.");
      }
    } finally {
      setLoading(false);
    }
  }, [page, qDebounced, bucket]);

  const loadMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics");
      if (!res.ok) return;
      setMetrics((await res.json()) as Metrics);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    setPage(1);
  }, [qDebounced, bucket]);

  async function manualSync() {
    setSyncing(true);
    setBanner(null);
    try {
      const configurations = loadSheetConfigurations();
      if (configurations.length === 0) {
        setBanner(
          "No sheet connections are saved in this browser. Open Admin, add a Google Sheet, click Save, then try Manual Sync again."
        );
        return;
      }
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configurations }),
      });
      const j = (await res.json()) as {
        ok: boolean;
        inserted?: number;
        merged?: number;
        duplicatesPrevented?: number;
        error?: string;
      };
      if (!j.ok) {
        setBanner(j.error || "Sync failed");
        return;
      }
      setBanner(
        `Synced: ${j.inserted ?? 0} new, ${j.merged ?? 0} existing rows merged, ${j.duplicatesPrevented ?? 0} duplicate rows skipped in batch.`
      );
      await load();
      await loadMetrics();
    } catch (e) {
      if (looksLikeNoServer(e)) {
        setBanner(
          "Could not reach the server. Run npm run dev in the web folder, open this app at http://localhost:3000, or use npm run dev:lan if you browse from another device on the network."
        );
      } else {
        setBanner(e instanceof Error ? e.message : "Sync error");
      }
    } finally {
      setSyncing(false);
    }
  }

  function formatWhen(iso: string | null) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  const patchLead = useCallback(async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = (await res.json()) as { ok?: boolean; lead?: LeadRecord; error?: string };
    if (res.ok && j.lead) {
      setRows((prev) => prev.map((r) => (r.id === id ? j.lead! : r)));
      void loadMetrics();
      return j.lead;
    }
    if (j.error) setBanner(j.error);
    return null;
  }, [loadMetrics]);

  function copyPhone(phone: string, id: string) {
    void navigator.clipboard.writeText(phone);
    setCopyId(id);
    setTimeout(() => setCopyId(null), 2000);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <AppNav />
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight sm:text-xl">Lead Command Center</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Map sheets in Admin, then manual sync. Deduplication by phone; newest first.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
              Last sheet sync:{" "}
              <time dateTime={metrics?.lastSyncAt ?? ""}>{formatWhen(metrics?.lastSyncAt ?? null)}</time>
            </span>
            <button
              type="button"
              onClick={() => void manualSync()}
              disabled={syncing}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                "bg-sky-600 text-white shadow hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60",
                "dark:bg-sky-500 dark:hover:bg-sky-400"
              )}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 shrink-0" />
              )}
              Manual Sync
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {banner && (
        <div className="mx-auto max-w-7xl px-4 pt-4 text-sm text-sky-800 dark:text-sky-200">
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 dark:border-sky-800 dark:bg-sky-950/50">
            {banner}
          </p>
        </div>
      )}

      {!hasSavedSheetConnections && (
        <div className="mx-auto max-w-7xl px-4 pt-4 text-sm text-amber-900 dark:text-amber-100">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/40">
            You have <strong>no saved sheet connections</strong> in this browser (Admin → Save). Without them, the server has nothing to sync.{" "}
            <Link href="/admin" className="font-medium text-amber-950 underline dark:text-amber-50">
              Open Admin
            </Link>
            .
          </p>
        </div>
      )}

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <MetricCard
            icon={BarChart3}
            label="Total Leads"
            value={metrics == null ? "…" : String(metrics.totalLeads ?? 0)}
            sub="in master database"
          />
          <MetricCard
            icon={UserPlus}
            label="New Leads Today"
            value={metrics == null ? "…" : String(metrics.newLeadsToday ?? 0)}
            sub="created since midnight (UTC date)"
          />
          <MetricCard
            icon={Shield}
            label="Duplicates Prevented"
            value={metrics == null ? "…" : String(metrics.duplicatesPrevented ?? 0)}
            sub="cumulative (same phone)"
          />
        </section>

        <div className="space-y-3">
          <div
            className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 bg-zinc-100/60 p-1 dark:border-zinc-700 dark:bg-zinc-900/50"
            role="tablist"
            aria-label="Quick filters"
          >
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={bucket === t.id}
                onClick={() => setBucket(t.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  bucket === t.id
                    ? "bg-white text-sky-800 shadow dark:bg-zinc-800 dark:text-sky-200"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, phone, service, or note…"
              className={cn(
                "w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm",
                "focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500",
                "dark:border-zinc-700 dark:bg-zinc-900"
              )}
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  {[
                    "Campaign",
                    "Full name",
                    "Phone",
                    "Service required",
                    "Status & next action",
                    "1st action (Call)",
                    "Whatsapp",
                    "Reminder",
                    "Last updated",
                    "Assigned to",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-2 py-2.5 text-xs font-semibold text-zinc-500"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={11} className="px-3 py-10 text-center text-zinc-500">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((l) => (
                    <LeadRow
                      key={l.id}
                      lead={l}
                      onUpdate={patchLead}
                      onCopy={copyPhone}
                      copyId={copyId}
                    />
                  ))}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-zinc-500">
                      No leads match the current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
            <p className="text-zinc-500">
              Page {page} of {totalPages} — {total} total
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-md border border-zinc-200 px-2 py-1 text-xs enabled:hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:enabled:hover:bg-zinc-800"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-md border border-zinc-200 px-2 py-1 text-xs enabled:hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:enabled:hover:bg-zinc-800"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: ElementType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="mb-1 flex items-center gap-2 text-zinc-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="text-xs text-zinc-500">{sub}</p>
    </div>
  );
}
