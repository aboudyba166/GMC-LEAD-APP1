"use client";

import { useEffect, useRef, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { AppNav } from "@/components/app-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import {
  createEmptySheetConfiguration,
  normalizeSpreadsheetId,
  validateColumnLetter,
  validateColumnLetterOrEmpty,
  type SheetConfiguration,
} from "@/lib/sheet-config";
import {
  clearAllSheetConfigurationsLocal,
  getLastSheetConfigSavedDisplay,
  LCC_SHEET_CONFIG_CHANGED_EVENT,
  loadSheetConfigurations,
  removeLegacySheetConfigurationKey,
  saveSheetConfigurations,
} from "@/lib/sheet-config-browser";
import { CheckCircle2, Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";

type FormValues = {
  configs: SheetConfiguration[];
};

function initialFormConfigs(): SheetConfiguration[] {
  const loaded = loadSheetConfigurations();
  if (loaded.length > 0) return loaded;
  return [createEmptySheetConfiguration()];
}

export default function AdminPage() {
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showSavedBanner, setShowSavedBanner] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const savedBannerTid = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { control, register, handleSubmit, reset, setValue, formState } = useForm<FormValues>({
    defaultValues: { configs: [createEmptySheetConfiguration()] },
  });
  const { isDirty } = formState;
  const { fields, append, remove } = useFieldArray({ control, name: "configs" });
  const watched = useWatch({ control, name: "configs" });

  useEffect(() => {
    removeLegacySheetConfigurationKey();
    const configs = initialFormConfigs();
    reset({ configs });
    setLastSaved(getLastSheetConfigSavedDisplay());
    
    // If we have saved configs, lock them by default
    if (configs.length > 0 && configs[0].spreadsheetId) {
      setIsLocked(true);
    } else {
      setIsLocked(false);
    }
  }, [reset]);

  useEffect(
    () => () => {
      if (savedBannerTid.current) clearTimeout(savedBannerTid.current);
    },
    []
  );

  function onSubmit(data: FormValues) {
    saveSheetConfigurations(data.configs);
    window.dispatchEvent(new Event(LCC_SHEET_CONFIG_CHANGED_EVENT));
    const d = new Date();
    setLastSaved(d.toLocaleString());
    setShowSavedBanner(true);
    if (savedBannerTid.current) clearTimeout(savedBannerTid.current);
    savedBannerTid.current = setTimeout(() => setShowSavedBanner(false), 8000);
    reset(data);
    setIsLocked(true);
  }

  function normalizeIdField(index: number) {
    if (isLocked) return;
    const raw = watched?.[index]?.spreadsheetId;
    if (raw == null || String(raw).trim() === "") return;
    setValue(`configs.${index}.spreadsheetId`, normalizeSpreadsheetId(String(raw)));
  }

  function clearEverythingAndStartFresh() {
    if (isLocked) {
      alert("Admin settings are locked. Click 'Unlock Settings' to make changes.");
      return;
    }
    if (!window.confirm("Delete all saved sheet connections in this browser and start with one empty form?")) {
      return;
    }
    clearAllSheetConfigurationsLocal();
    window.dispatchEvent(new Event(LCC_SHEET_CONFIG_CHANGED_EVENT));
    setLastSaved(null);
    setShowSavedBanner(false);
    reset({ configs: [createEmptySheetConfiguration()] });
  }

  async function cleanDatabaseOnServer() {
    if (!window.confirm("CRITICAL: This will delete ALL leads from the server database. This cannot be undone. Proceed?")) {
      return;
    }
    
    try {
      const res = await fetch("/api/admin/clean-db", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        alert("Database cleaned successfully. Refresh the dashboard to see changes.");
      } else {
        alert("Error: " + (data.error || "Failed to clean database"));
      }
    } catch (e) {
      alert("Network error: Could not reach the server.");
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <AppNav />
      <header className="border-b border-zinc-200 bg-white/90 dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">Admin — Sheet connections</h1>
              <button
                type="button"
                onClick={() => setIsLocked(!isLocked)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all",
                  isLocked 
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400" 
                    : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
                )}
              >
                {isLocked ? "🔒 Unlock Settings" : "🔓 Settings Unlocked"}
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              Add each Google Sheet as a connection, then click <strong>Save</strong>. Connections stay in this
              browser. On sync, the server uses <code className="rounded bg-zinc-200 px-1 dark:bg-zinc-800">GOOGLE_API_KEY</code>{" "}
              and the Sheets API (spreadsheets must use <strong>Anyone with the link</strong> → Viewer, or be public, so
              the key can read them).
            </p>
            {lastSaved && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>Connections last saved: {lastSaved} — they will load here the next time you open Admin.</span>
              </p>
            )}
            {isDirty && (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-500">You have unsaved changes. Click Save to keep them.</p>
            )}
          </div>
          <ThemeToggle />
        </div>
      </header>

      {showSavedBanner && (
        <div className="mx-auto max-w-4xl px-4 pt-4">
          <p className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Changes saved. You can keep editing; click Save again after further changes.
          </p>
        </div>
      )}

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {fields.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-100/50 p-8 text-center text-sm text-zinc-600 dark:border-zinc-600 dark:bg-zinc-900/30 dark:text-zinc-400">
              <p className="mb-3">No connections yet. Add your first one, then save.</p>
              <button
                type="button"
                onClick={() => append(createEmptySheetConfiguration())}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
              >
                <Plus className="h-4 w-4" />
                Add first connection
              </button>
            </div>
          ) : null}

          {fields.map((field, index) => {
            const nameLabel = (watched?.[index]?.name && String(watched?.[index]?.name).trim()) || "";
            const isExpanded = expandedIndex === index;
            
            return (
            <fieldset
              key={field.id}
              className={cn(
                "overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all dark:border-zinc-800 dark:bg-zinc-900/50",
                !isExpanded && "hover:border-zinc-300 dark:hover:border-zinc-700"
              )}
            >
              <div 
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 px-4 py-3",
                  isExpanded ? "border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30" : ""
                )}
                onClick={() => setExpandedIndex(isExpanded ? null : index)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
                  <legend className="text-sm font-semibold">
                    Connection {index + 1}
                    {nameLabel ? <span className="ml-2 font-normal text-zinc-500">— {nameLabel}</span> : null}
                  </legend>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="rounded p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    title="Remove this connection"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {isExpanded && (
              <div className="p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-zinc-500">
                      Connection name
                      <input
                        {...register(`configs.${index}.name`)}
                        disabled={isLocked}
                        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800"
                        placeholder="e.g. Main leads tab"
                        required
                      />
                    </label>
                    <label className="block text-xs font-medium text-zinc-500">
                      Spreadsheet ID or URL
                      <input
                        {...register(`configs.${index}.spreadsheetId`)}
                        onBlur={() => normalizeIdField(index)}
                        disabled={isLocked}
                        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm font-mono text-xs disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800"
                        placeholder="Paste full Google Sheets link or the ID"
                        required
                      />
                    </label>
                    <label className="block text-xs font-medium text-zinc-500">
                      Tab GID (optional)
                      <input
                        type="number"
                        inputMode="numeric"
                        disabled={isLocked}
                        placeholder="from URL: …#gid=626655690"
                        {...register(`configs.${index}.sheetGid`, {
                          setValueAs: (v) => {
                            if (v === "" || v == null) return undefined;
                            const n = Number(v);
                            return Number.isFinite(n) ? n : undefined;
                          },
                        })}
                        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm font-mono disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800"
                      />
                    </label>
                    <label className="sm:col-span-2 block text-xs font-medium text-zinc-500">
                      Tab name (required if GID is empty)
                      <input
                        {...register(`configs.${index}.tabName`, {
                          validate: (v, form) => {
                            const list = (form as FormValues).configs;
                            const gid = list?.[index]?.sheetGid;
                            if (gid != null && Number.isFinite(Number(gid))) return true;
                            return (v && String(v).trim().length > 0) || "Set tab name, or set Tab GID from the sheet URL";
                          },
                        })}
                        disabled={isLocked}
                        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800"
                        placeholder="Sheet1 (ignored when GID is set)"
                      />
                    </label>
                  </div>

                  <p className="mb-2 mt-4 text-xs font-medium text-zinc-500">Column letters (A–Z, AA, …)</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        { key: "campaign", label: "Campaign data (optional)", emptyOk: true },
                        { key: "fullName", label: "Full name", emptyOk: false },
                        { key: "phone", label: "Phone number", emptyOk: false },
                        { key: "serviceRequired", label: "Service required", emptyOk: false },
                        { key: "receivedAt", label: "Received date/time (optional)", emptyOk: true },
                        {
                          key: "existingStatus",
                          label: "Existing status / feedback (optional)",
                          emptyOk: true,
                        },
                      ] as const
                    ).map((col) => (
                      <label key={col.key} className="block text-xs font-medium text-zinc-500">
                        {col.label}
                        <input
                          {...register(`configs.${index}.columns.${col.key}`, {
                            validate: (v) => {
                              const s = String(v);
                              if (col.emptyOk) {
                                return validateColumnLetterOrEmpty(s) || "Use column letter(s) or leave blank";
                              }
                              return !s.trim() || validateColumnLetter(s) || "Use column letter(s) A–Z";
                            },
                          })}
                          disabled={isLocked}
                          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm font-mono uppercase disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800"
                          maxLength={3}
                        />
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-500">
                    When the status column is set, synced rows use that cell to set the app status. Blank cell →
                    &quot;New Lead&quot; for new phones. Leave empty to always use &quot;New Lead&quot; for new phones.
                  </p>
                </div>
              )}
            </fieldset>
            );
          })}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isLocked}
              onClick={() => append(createEmptySheetConfiguration())}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm",
                "text-zinc-700 hover:border-sky-400 hover:text-sky-800 disabled:opacity-40 dark:border-zinc-600 dark:hover:text-sky-300"
              )}
            >
              <Plus className="h-4 w-4" />
              Add connection
            </button>
            <button
              type="submit"
              disabled={isLocked}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
            >
              Save connections
            </button>
            <button
              type="button"
              disabled={isLocked}
              onClick={clearEverythingAndStartFresh}
              className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-rose-800 hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900 dark:bg-zinc-900 dark:text-rose-200 dark:hover:bg-rose-950/50"
            >
              Clear all &amp; start over
            </button>
            <button
              type="button"
              onClick={cleanDatabaseOnServer}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 shadow-sm"
            >
              Clean Server Database
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
