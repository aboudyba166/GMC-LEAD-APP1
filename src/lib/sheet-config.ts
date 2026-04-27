import { nanoid } from "nanoid";

/** Saved in localStorage and sent to /api/sync */
export type SheetColumnMapping = {
  campaign: string;
  fullName: string;
  phone: string;
  serviceRequired: string;
  /** Column letter for the date/time the lead was received in the source sheet */
  receivedAt?: string;
  /** Column letter for historical status/feedback; empty = not mapped (new leads default to "New Lead") */
  existingStatus?: string;
};

export type SheetConfiguration = {
  id: string;
  name: string;
  spreadsheetId: string;
  /**
   * Sheet tab title (must match the tab in Google Sheets). If `sheetGid` is set, this is optional
   * and the tab is resolved by ID at sync time.
   */
  tabName: string;
  /** When set, the tab is resolved via the Sheets API using this numeric gid (see URL #gid=…). */
  sheetGid?: number;
  columns: SheetColumnMapping;
};

/** Current storage key for Admin sheet connections. */
export const SHEET_CONFIG_STORAGE_KEY = "lcc_sheet_configurations_v3";

export const SHEET_CONFIG_STORAGE_KEY_LEGACY_V1 = "lcc_sheet_configurations_v1";
export const SHEET_CONFIG_STORAGE_KEY_LEGACY_V2 = "lcc_sheet_configurations_v2";

export const SHEET_CONFIG_LAST_SAVED_AT_KEY = "lcc_admin_last_saved_at";

export function createEmptySheetConfiguration(): SheetConfiguration {
  return {
    id: nanoid(),
    name: "",
    spreadsheetId: "",
    tabName: "Sheet1",
    columns: {
      campaign: "A",
      fullName: "B",
      phone: "C",
      serviceRequired: "D",
      receivedAt: "W",
      existingStatus: "",
    },
  };
}

export function normalizeSpreadsheetId(input: string): string {
  const t = input.trim();
  const m = t.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]+$/.test(t)) return t;
  return t;
}

export function validateColumnLetter(s: string): boolean {
  const v = s.trim().toUpperCase();
  return /^[A-Z]{1,3}$/.test(v);
}

/** Allow empty = do not read status from sheet */
export function validateColumnLetterOrEmpty(s: string): boolean {
  if (!s.trim()) return true;
  return validateColumnLetter(s);
}

/**
 * GID is often a number, but `JSON.parse` / older saves / forms may leave it as a string.
 * Without coercion, strict `typeof x === "number"` checks drop otherwise valid connections.
 */
export function coerceSheetGid(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const t = value.trim();
    if (!t) return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Single parser for localStorage and `/api/sync` so client and server accept the same shape.
 */
export function tryParseSheetConfiguration(x: unknown): SheetConfiguration | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const col = o.columns;
  if (!col || typeof col !== "object") return null;
  const c = col as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    typeof o.name !== "string" ||
    typeof o.spreadsheetId !== "string" ||
    typeof o.tabName !== "string"
  ) {
    return null;
  }
  if (
    typeof c.campaign !== "string" ||
    typeof c.fullName !== "string" ||
    typeof c.phone !== "string" ||
    typeof c.serviceRequired !== "string" ||
    (c.receivedAt !== undefined && typeof c.receivedAt !== "string") ||
    (c.existingStatus !== undefined && typeof c.existingStatus !== "string")
  ) {
    return null;
  }
  const sheetGid = coerceSheetGid(o.sheetGid);
  const hasGid = sheetGid !== undefined;
  if (!hasGid && !o.tabName.trim()) return null;
  const columns: SheetColumnMapping = {
    campaign: c.campaign,
    fullName: c.fullName,
    phone: c.phone,
    serviceRequired: c.serviceRequired,
  };
  if (typeof c.receivedAt === "string") {
    columns.receivedAt = c.receivedAt;
  }
  if (typeof c.existingStatus === "string") {
    columns.existingStatus = c.existingStatus;
  }
  return {
    id: o.id,
    name: o.name,
    spreadsheetId: o.spreadsheetId,
    tabName: o.tabName,
    ...(hasGid ? { sheetGid } : {}),
    columns,
  };
}
