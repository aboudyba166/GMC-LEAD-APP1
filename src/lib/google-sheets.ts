import { columnLetterToIndex, indexToColumnLetter0 } from "./column-utils";
import type { SheetConfiguration } from "./sheet-config";
import {
  mapRowWithConfiguration,
  resolveInitialStatus,
  rowLooksEmptyDynamic,
  toStandardLead,
} from "./dynamic-sheet-map";
import { normalizePhoneKey } from "./phone-dedupe";
import type { LeadStatus } from "./lead-status";
import type { StandardLeadRow } from "./types";

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

/**
 * Google Sheets v4 over HTTPS using `fetch` and a standard API key (no service account).
 * The key must be allowed for the Sheets API in Google Cloud. Spreadsheets must be
 * readable with a key: use Share → "Anyone with the link" (Viewer) or a public link.
 */
function getApiKeyFromEnv(): string {
  const k = process.env.GOOGLE_API_KEY?.trim();
  if (!k) {
    throw new Error(
      "Missing GOOGLE_API_KEY. Add it to web/.env.local (or your host env). Enable Google Sheets API for the key in Google Cloud."
    );
  }
  return k;
}

type SheetsApiErrorBody = { error?: { message?: string } };

async function fetchSheetsJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { method: "GET" });
  const data = (await res.json()) as T & SheetsApiErrorBody;
  if (!res.ok) {
    const msg = data.error?.message ?? "Request failed";
    throw new Error(`Google Sheets API HTTP ${res.status}: ${msg}`);
  }
  return data;
}

const MAX_SYNC_ROWS = 5000;
/** Extra columns past the rightmost mapped letter (buffer for the sheet). */
const COL_BUFFER = 2;

/**
 * A1 range for a tab: covers A1 through the last mapped column (plus buffer) up to MAX_SYNC_ROWS.
 * Avoids fixed `A1:ZZ5000` which the API may reject (400 "Unable to parse range").
 */
function a1RangeForConfig(tabTitle: string, config: SheetConfiguration): string {
  const c = config.columns;
  const letters = [
    c.campaign,
    c.fullName,
    c.phone,
    c.serviceRequired,
    c.existingStatus ?? "",
  ]
    .map((s) => String(s ?? "").trim())
    .filter(Boolean);

  let maxIdx0 = 0;
  for (const L of letters) {
    maxIdx0 = Math.max(maxIdx0, columnLetterToIndex(L));
  }
  const endIdx0 = maxIdx0 + COL_BUFFER;
  const endCol = indexToColumnLetter0(endIdx0);
  const safe = tabTitle.replace(/'/g, "''");
  const unquoted = /^[A-Za-z0-9_]+$/.test(tabTitle);
  const sheetRef = unquoted ? safe : `'${safe}'`;
  return `${sheetRef}!A1:${endCol}${MAX_SYNC_ROWS}`;
}

type SheetIdToTitle = Map<number, string>;

type SpreadsheetGetResponse = {
  sheets?: Array<{
    properties?: { sheetId?: number; title?: string };
  }>;
};

type ValuesGetResponse = {
  values?: string[][];
};

/** Load tab metadata to map gid (sheetId) → title. */
async function buildGidTitleMap(spreadsheetId: string): Promise<SheetIdToTitle> {
  const key = getApiKeyFromEnv();
  const fields = encodeURIComponent("sheets.properties(sheetId,title)");
  const url = `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}?fields=${fields}&key=${encodeURIComponent(key)}`;
  const data = await fetchSheetsJson<SpreadsheetGetResponse>(url);
  const m: SheetIdToTitle = new Map();
  for (const sh of data.sheets ?? []) {
    const id = sh.properties?.sheetId;
    const title = sh.properties?.title;
    if (id != null && title) m.set(id, title);
  }
  return m;
}

async function fetchRangeValues(spreadsheetId: string, a1Range: string): Promise<string[][]> {
  const key = getApiKeyFromEnv();
  const rangeParam = encodeURIComponent(a1Range);
  const url = `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values/${rangeParam}?key=${encodeURIComponent(key)}`;
  const data = await fetchSheetsJson<ValuesGetResponse>(url);
  return data.values ?? [];
}

export type FetchedSourceRow = {
  lead: StandardLeadRow;
  sourceId: string;
  sourceLabel: string;
  initialStatus: LeadStatus;
  /** 1-based Google Sheet row (row 1 is the first line in the tab). */
  sheetRow: number;
};

function parseGrid(
  config: SheetConfiguration,
  values: string[][]
): FetchedSourceRow[] {
  const start = values.length > 0 ? 1 : 0;
  const outRows: FetchedSourceRow[] = [];
  for (let r = start; r < values.length; r++) {
    const row = values[r] ?? [];
    const raw = mapRowWithConfiguration(row, config);
    const lead = toStandardLead(raw);
    if (rowLooksEmptyDynamic(lead) || !normalizePhoneKey(lead.phoneNumber)) continue;
    const initialStatus = resolveInitialStatus(raw.existingStatusRaw, raw.statusColumnMapped);
    const sheetRow = r + 1;
    
    // Parse receivedAt from sheet if available, otherwise use now
    let createdAt = new Date().toISOString();
    if (raw.receivedAtRaw && raw.receivedAtRaw.trim()) {
      try {
        // Handle Google Sheets date format (often MM/DD/YYYY or DD/MM/YYYY)
        const parsed = new Date(raw.receivedAtRaw);
        if (!isNaN(parsed.getTime())) {
          createdAt = parsed.toISOString();
        }
      } catch {
        /* fallback to now */
      }
    }

    // Use Phone + Service + Row as the unique key to allow same person/service on different rows
    const k = `${normalizePhoneKey(lead.phoneNumber)}_${(lead.serviceRequired || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')}_${sheetRow}`;
    
    // If createdAt is still "now", it means it wasn't in the sheet or couldn't be parsed.
    // However, the user wants the time it was added to the original source.
    // If the sheet doesn't have a timestamp column, we can't "guess" the past time,
    // but we can ensure that we only set it ONCE when it first enters our system.
    
    outRows.push({
      lead,
      sourceId: config.id,
      sourceLabel: config.name || config.id,
      initialStatus,
      sheetRow,
      createdAt,
    });
  }
  return outRows;
}

/**
 * Fetches all rows from every admin configuration, in order.
 */
export async function fetchFromConfigurations(
  configurations: SheetConfiguration[]
): Promise<FetchedSourceRow[]> {
  if (!configurations.length) {
    return [];
  }
  getApiKeyFromEnv();
  const out: FetchedSourceRow[] = [];
  const gidMapCache = new Map<string, SheetIdToTitle>();

  for (const config of configurations) {
    const sid = config.spreadsheetId?.trim();
    if (!sid) continue;
    let tabTitle: string;
    if (config.sheetGid != null && Number.isFinite(config.sheetGid)) {
      if (!gidMapCache.has(sid)) {
        gidMapCache.set(sid, await buildGidTitleMap(sid));
      }
      const map = gidMapCache.get(sid)!;
      const t = map.get(config.sheetGid);
      if (!t) {
        throw new Error(
          `Sheet gid ${config.sheetGid} not found in spreadsheet ${sid}. Check the URL, or that the API key can access this file (link sharing: Anyone with the link, Viewer).`
        );
      }
      tabTitle = t;
    } else {
      tabTitle = config.tabName?.trim() ?? "";
      if (!tabTitle) continue;
    }
    const range = a1RangeForConfig(tabTitle, config);
    const values = await fetchRangeValues(sid, range);
    out.push(...parseGrid(config, values));
  }
  return out;
}
