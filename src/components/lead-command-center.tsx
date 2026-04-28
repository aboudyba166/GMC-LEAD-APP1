"use client";

import Link from "next/link";
import Image from "next/image";
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
  const [agentName, setAgentName] = useState<string>("");

  // Load agent name from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("lcc_agent_name");
    if (saved) setAgentName(saved);
  }, []);

  const saveAgentName = (name: string) => {
    setAgentName(name);
    localStorage.setItem("lcc_agent_name", name);
  };

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, []);

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
        sort: sortOrder,
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
  }, [page, qDebounced, bucket, sortOrder]);

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

  // Auto-sync every 1 minute
  useEffect(() => {
    const interval = setInterval(() => {
      void manualSync(true); // true means background sync
    }, 60000);
    return () => clearInterval(interval);
  }, [load]);

  async function manualSync(isBackground = false) {
    if (!isBackground) setSyncing(true);
    if (!isBackground) setBanner(null);
    try {
      // ALWAYS load configurations from the server first
      let configurations = [];
      try {
        const connRes = await fetch("/api/admin/connections");
        const connData = await connRes.json();
        if (connRes.ok && connData.connections?.length > 0) {
          configurations = connData.connections;
          // Sync local storage with server data for redundancy
          saveSheetConfigurations(configurations);
        }
      } catch (e) {
        console.warn("Failed to load connections from server, falling back to local storage", e);
      }

      // Fallback to local storage ONLY if server is unreachable or empty
      if (configurations.length === 0) {
        configurations = loadSheetConfigurations();
      }

      if (configurations.length === 0) {
        if (!isBackground) {
          setBanner(
            "No sheet connections found. Please go to Admin, add your Google Sheets, and click Save."
          );
        }
        return;
      }
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          configurations,
          isAutoSync: isBackground 
        }),
      });
      const j = (await res.json()) as {
        ok: boolean;
        inserted?: number;
        merged?: number;
        duplicatesPrevented?: number;
        error?: string;
      };
      if (!j.ok) {
        if (!isBackground) setBanner(j.error || "Sync failed");
        return;
      }

      if (j.inserted && j.inserted > 0) {
        if ("Notification" in window && Notification.permission === "granted") {
          const n = new Notification("GMC: New Lead Received!", {
            body: `You have ${j.inserted} new lead(s) waiting for response.`,
            icon: "/assets/logo.png",
            requireInteraction: true, // Keeps notification visible until user clicks
            silent: false,
          });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        }
      }

      if (!isBackground) {
        setBanner(
          `Synced: ${j.inserted ?? 0} new, ${j.merged ?? 0} existing rows merged, ${j.duplicatesPrevented ?? 0} duplicate rows skipped in batch.`
        );
      }
      await load();
      await loadMetrics();
    } catch (e) {
      if (!isBackground) {
        if (looksLikeNoServer(e)) {
          setBanner(
            "Could not reach the server. Run npm run dev in the web folder, open this app at http://localhost:3000, or use npm run dev:lan if you browse from another device on the network."
          );
        } else {
          setBanner(e instanceof Error ? e.message : "Sync error");
        }
      }
    } finally {
      if (!isBackground) setSyncing(false);
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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 selection:bg-sky-100 dark:selection:bg-sky-900/40">
      <AppNav />
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-lg bg-zinc-900 p-1 shadow-inner dark:bg-white">
              <Image
                src="/assets/logo.png"
                alt="GMC Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-xl">
                Gardenia Medical <span className="text-sky-600 dark:text-sky-400">Centre</span>
              </h1>
              <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
                Lead Command Center
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-[10px] font-bold uppercase text-zinc-400">Agent:</span>
              <input
                type="text"
                value={agentName}
                onChange={(e) => saveAgentName(e.target.value)}
                placeholder="Your Name"
                className="w-24 bg-transparent text-xs font-semibold focus:outline-none dark:text-zinc-100"
              />
            </div>
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
                "w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm transition-all",
                "focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10",
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
                    "Service",
                    "Status & Action",
                    "1st Call",
                    "WA",
                    "Rem.",
                    "Time",
                    "Agent",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        "whitespace-nowrap px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400",
                        h === "Time" && "cursor-pointer hover:text-sky-600 transition-colors"
                      )}
                      onClick={h === "Time" ? () => setSortOrder(sortOrder === "desc" ? "asc" : "desc") : undefined}
                    >
                      <div className="flex items-center gap-1">
                        {h}
                        {h === "Time" && (
                          <span className="text-[8px]">
                            {sortOrder === "desc" ? "▼" : "▲"}
                          </span>
                        )}
                      </div>
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
                      currentAgent={agentName}
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
    <div className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="absolute -right-2 -top-2 opacity-[0.03] transition-transform group-hover:scale-110">
        <Icon className="h-16 w-16" />
      </div>
      <div className="mb-1 flex items-center gap-2 text-zinc-500">
        <Icon className="h-4 w-4 text-sky-600 dark:text-sky-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{sub}</p>
    </div>
  );
}
