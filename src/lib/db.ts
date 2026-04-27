import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import { normalizePhoneKey } from "./phone-dedupe";
import { LEAD_STATUS, normalizeStatusFromDb, type LeadStatus } from "./lead-status";
import type { LeadRecord, StandardLeadRow, YesNo } from "./types";

// Next.js bundles this file under .next/server/chunks; `import.meta.url` there points at the
// chunk, so a path relative to it lands under .next/data. Anchor to the app root instead.
const dbFile = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "leads.db");

let db: Database.Database | null = null;

export function getDb() {
  if (db) return db;
  const dir = path.dirname(dbFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const instance = new Database(dbFile);
  instance.pragma("journal_mode = WAL");
  migrate(instance);
  db = instance;
  return instance;
}

function columnNames(database: Database.Database, table: string): Set<string> {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return new Set(rows.map((r) => r.name));
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      campaign_data TEXT NOT NULL DEFAULT '',
      full_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      phone_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'New Lead',
      assigned_to TEXT NOT NULL DEFAULT '',
      source_id TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_phone_key ON leads(phone_key);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_at);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const cols = columnNames(database, "leads");
  const add = (name: string, sql: string) => {
    if (!cols.has(name)) database.exec(sql);
  };
  add("fetched_at", "ALTER TABLE leads ADD COLUMN fetched_at TEXT");
  add("first_action_at", "ALTER TABLE leads ADD COLUMN first_action_at TEXT");
  add("follow_up_at", "ALTER TABLE leads ADD COLUMN follow_up_at TEXT");
  add("follow_up_note", "ALTER TABLE leads ADD COLUMN follow_up_note TEXT");
  add("lost_reason", "ALTER TABLE leads ADD COLUMN lost_reason TEXT");
  add("service_required", "ALTER TABLE leads ADD COLUMN service_required TEXT");
  add("action_call", "ALTER TABLE leads ADD COLUMN action_call TEXT");
  add("whatsapp_sent", "ALTER TABLE leads ADD COLUMN whatsapp_sent TEXT");
  add("reminder_sent", "ALTER TABLE leads ADD COLUMN reminder_sent TEXT");
  add("source_row", "ALTER TABLE leads ADD COLUMN source_row INTEGER");

  database.exec(`
    UPDATE leads SET fetched_at = created_at WHERE fetched_at IS NULL OR fetched_at = '';
    UPDATE leads SET service_required = email WHERE (service_required IS NULL OR service_required = '') AND email IS NOT NULL;
    UPDATE leads SET status = 'New Lead' WHERE status IN ('New','Calling','Connected','Unreachable','Dead');
    UPDATE leads SET status = 'New Lead' WHERE status NOT IN (
      'New Lead','لم يتم الرد','استفسار','he / she will call back','تم الحجز','غير مهتم','السعر غالي',
      'ارسل الرقم بالغلط','الرقم غلط','خارج الخدمه'
    );
  `);

  const dup = database.prepare("SELECT 1 FROM settings WHERE key = ?").get("duplicates_prevented_total");
  if (!dup) {
    database
      .prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)")
      .run("duplicates_prevented_total", "0");
  }

  /* Remove legacy seeded mock rows (ids were mock-*) */
  database.exec(`DELETE FROM leads WHERE id GLOB 'mock-*';`);
}

type Row = {
  id: string;
  campaign_data: string;
  full_name: string;
  phone: string;
  email: string;
  service_required: string | null;
  phone_key: string;
  status: string;
  assigned_to: string;
  source_id: string;
  created_at: string;
  updated_at: string;
  fetched_at: string | null;
  first_action_at: string | null;
  follow_up_at: string | null;
  follow_up_note: string | null;
  lost_reason: string | null;
  action_call: string | null;
  whatsapp_sent: string | null;
  reminder_sent: string | null;
  source_row: number | null;
};

function zYesNo(s: string | null | undefined): YesNo {
  if (s === "yes" || s === "no") return s;
  return "";
}

function rowToLead(r: Row): LeadRecord {
  const st = normalizeStatusFromDb(r.status);
  const z = (x: string | null | undefined) => (x && x.trim() ? x : null);
  const svc = (r.service_required && r.service_required.trim()) || r.email || "";
  return {
    id: r.id,
    campaignData: r.campaign_data,
    fullName: r.full_name,
    phoneNumber: r.phone,
    serviceRequired: svc,
    phoneKey: r.phone_key,
    status: st,
    assignedTo: r.assigned_to,
    sourceId: r.source_id,
    sourceRow: r.source_row ?? null,
    createdAt: r.created_at,
    fetchedAt: r.fetched_at || r.created_at,
    firstActionAt: z(r.first_action_at),
    lastUpdatedAt: r.updated_at,
    followUpAt: z(r.follow_up_at),
    followUpNote: z(r.follow_up_note),
    lostReason: z(r.lost_reason),
    actionCall: (r.action_call && r.action_call.trim()) || "",
    whatsappSent: zYesNo(r.whatsapp_sent),
    reminderSent: zYesNo(r.reminder_sent),
  };
}

export type ListParams = {
  page: number;
  pageSize: number;
  q?: string;
  status?: string;
  bucket?: string;
};

export function listLeadsPage(params: ListParams): { items: LeadRecord[]; total: number } {
  const d = getDb();
  const { page, pageSize, q, status, bucket } = params;
  const offset = (page - 1) * pageSize;
  const wh: string[] = [];
  const args: (string | number)[] = [];
  if (q?.trim()) {
    const t = q.trim();
    wh.push(
      "(full_name LIKE ? OR phone LIKE ? OR email LIKE ? OR service_required LIKE ? OR campaign_data LIKE ? OR lost_reason LIKE ? OR follow_up_note LIKE ? OR action_call LIKE ?)"
    );
    const like = `%${t.replace(/%/g, "")}%`;
    args.push(like, like, like, like, like, like, like, like);
  }
  if (bucket && bucket !== "all") {
    const map: Record<string, string[]> = {
      new: [LEAD_STATUS.NEW_LEAD],
      follow_up: [LEAD_STATUS.NO_ANSWER, LEAD_STATUS.INQUIRY, LEAD_STATUS.WILL_CALL_BACK],
      won: [LEAD_STATUS.BOOKED],
      lost: [LEAD_STATUS.NOT_INTERESTED, LEAD_STATUS.PRICE_HIGH],
      invalid: [LEAD_STATUS.SENT_MISTAKE, LEAD_STATUS.WRONG_NUMBER, LEAD_STATUS.OUT_OF_SERVICE],
    };
    const list = map[bucket];
    if (list?.length) {
      wh.push(`status IN (${list.map(() => "?").join(",")})`);
      args.push(...list);
    }
  } else if (status && status !== "all") {
    wh.push("status = ?");
    args.push(status);
  }
  const where = wh.length ? `WHERE ${wh.join(" AND ")}` : "";
  const total = (
    d.prepare(`SELECT count(*) as n FROM leads ${where}`).get(...args) as { n: number }
  ).n;
  const rows = d
    .prepare(
      `SELECT * FROM leads ${where}
       ORDER BY COALESCE(source_row, -1) DESC, source_id DESC, datetime(created_at) DESC
       LIMIT ? OFFSET ?`
    )
    .all(...args, pageSize, offset) as Row[];
  return { items: rows.map(rowToLead), total };
}

export function getLeadById(id: string): LeadRecord | null {
  const d = getDb();
  const r = d.prepare("SELECT * FROM leads WHERE id = ?").get(id) as Row | undefined;
  return r ? rowToLead(r) : null;
}

export function getMetrics() {
  const d = getDb();
  const total = (d.prepare("SELECT count(*) as n FROM leads").get() as { n: number }).n;
  const today = new Date().toISOString().slice(0, 10);
  const newToday = (
    d
      .prepare("SELECT count(*) as n FROM leads WHERE substr(created_at,1,10) = ?")
      .get(today) as { n: number }
  ).n;
  const dupes = (
    d
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("duplicates_prevented_total") as { value: string } | undefined
  )?.value;
  return {
    totalLeads: total,
    newLeadsToday: newToday,
    duplicatesPrevented: dupes ? parseInt(dupes, 10) : 0,
  };
}

export function getLastSyncAt(): string | null {
  const d = getDb();
  const r = d.prepare("SELECT value FROM settings WHERE key = 'last_sync_at'").get() as
    | { value: string }
    | undefined;
  return r?.value ?? null;
}

function bumpDupeTotal(n: number) {
  if (n <= 0) return;
  const d = getDb();
  const cur = d
    .prepare("SELECT value FROM settings WHERE key = ?")
    .get("duplicates_prevented_total") as { value: string } | undefined;
  const next = (cur ? parseInt(cur.value, 10) : 0) + n;
  d.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(
    "duplicates_prevented_total",
    String(next)
  );
}

export type SyncIngestionRow = {
  lead: StandardLeadRow;
  sourceId: string;
  initialStatus: LeadStatus;
  /** 1-based row in the sheet tab; used so newest = highest row, not first row. */
  sheetRow: number;
};

/** Last row in the batch wins for the same phone (higher sheet row / later connection). */
function dedupeSyncRowsLastWins(rows: SyncIngestionRow[]): {
  rows: SyncIngestionRow[];
  duplicatesInBatch: number;
} {
  const withKey: SyncIngestionRow[] = [];
  for (const r of rows) {
    const k = normalizePhoneKey(r.lead.phoneNumber);
    if (!k) continue;
    withKey.push(r);
  }
  const m = new Map<string, SyncIngestionRow>();
  for (const r of withKey) {
    m.set(normalizePhoneKey(r.lead.phoneNumber)!, r);
  }
  const deduped = Array.from(m.values());
  return {
    rows: deduped,
    duplicatesInBatch: withKey.length - deduped.length,
  };
}

export function runSyncIngestion(rows: SyncIngestionRow[]) {
  const d = getDb();
  let inserted = 0;
  let merged = 0;
  const { rows: toApply, duplicatesInBatch: dupesInBatch } = dedupeSyncRowsLastWins(rows);
  let dupesOrIgnore = 0;
  const now = new Date().toISOString();

  const getByKey = d.prepare("SELECT * FROM leads WHERE phone_key = ?");
  const ins = d.prepare(
    `INSERT OR IGNORE INTO leads
    (id, campaign_data, full_name, phone, email, service_required, phone_key, status, assigned_to, source_id,
     created_at, updated_at, fetched_at, first_action_at, follow_up_at, follow_up_note, lost_reason,
     action_call, whatsapp_sent, reminder_sent, source_row)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, '', '', '', ?)`
  );
  const updDataOnly = d.prepare(
    `UPDATE leads SET
      campaign_data = ?,
      full_name = ?,
      phone = ?,
      service_required = ?,
      email = ?,
      source_id = ?,
      source_row = ?
     WHERE phone_key = ?`
  );
  const updDataAndStatus = d.prepare(
    `UPDATE leads SET
      campaign_data = ?,
      full_name = ?,
      phone = ?,
      service_required = ?,
      email = ?,
      source_id = ?,
      status = ?,
      updated_at = ?,
      source_row = ?
     WHERE phone_key = ?`
  );

  for (const r of toApply) {
    const k = normalizePhoneKey(r.lead.phoneNumber);
    if (!k) {
      continue;
    }
    const svc = r.lead.serviceRequired;
    const prev = getByKey.get(k) as Row | undefined;
    if (!prev) {
      const id = nanoid();
      const res = ins.run(
        id,
        r.lead.campaignData,
        r.lead.fullName,
        r.lead.phoneNumber,
        svc,
        svc,
        k,
        r.initialStatus,
        "",
        r.sourceId,
        now,
        now,
        now,
        r.sheetRow
      );
      if (res.changes > 0) {
        inserted++;
      } else {
        dupesOrIgnore++;
      }
      continue;
    }

    const prevNorm = normalizeStatusFromDb(prev.status);
    const nextStatus = r.initialStatus;
    const statusChanged = prevNorm !== nextStatus;
    if (statusChanged) {
      updDataAndStatus.run(
        r.lead.campaignData,
        r.lead.fullName,
        r.lead.phoneNumber,
        svc,
        svc,
        r.sourceId,
        nextStatus,
        now,
        r.sheetRow,
        k
      );
    } else {
      updDataOnly.run(
        r.lead.campaignData,
        r.lead.fullName,
        r.lead.phoneNumber,
        svc,
        svc,
        r.sourceId,
        r.sheetRow,
        k
      );
    }
    merged++;
  }
  const duplicatesPrevented = dupesInBatch + dupesOrIgnore;
  bumpDupeTotal(duplicatesPrevented);
  d.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run("last_sync_at", now);
  return { inserted, merged, duplicatesPrevented, at: now };
}

export type LeadPatch = {
  status?: LeadStatus;
  assignedTo?: string;
  followUpAt?: string | null;
  followUpNote?: string | null;
  lostReason?: string | null;
  actionCall?: string;
  whatsappSent?: YesNo;
  reminderSent?: YesNo;
};

function shouldSetFirstAction(
  prev: Row,
  patch: LeadPatch,
  nextStatus: LeadStatus
): boolean {
  if (prev.first_action_at) return false;
  if (patch.status !== undefined && nextStatus !== LEAD_STATUS.NEW_LEAD) return true;
  if (patch.followUpAt && patch.followUpAt.trim()) return true;
  if (patch.followUpNote && patch.followUpNote.trim()) return true;
  if (patch.lostReason && patch.lostReason.trim()) return true;
  if (patch.actionCall && patch.actionCall.trim()) return true;
  if (patch.whatsappSent !== undefined) return true;
  if (patch.reminderSent !== undefined) return true;
  return false;
}

export function updateLead(id: string, patch: LeadPatch) {
  const d = getDb();
  const prev = d.prepare("SELECT * FROM leads WHERE id = ?").get(id) as Row | undefined;
  if (!prev) return { ok: false as const };

  const now = new Date().toISOString();
  const nextStatus = (patch.status ?? normalizeStatusFromDb(prev.status)) as LeadStatus;
  const firstAction = shouldSetFirstAction(prev, patch, nextStatus) ? now : prev.first_action_at;

  const f: string[] = ["updated_at = ?"];
  const a: string[] = [now];

  if (patch.status !== undefined) {
    f.push("status = ?");
    a.push(patch.status);
  }
  if (patch.assignedTo !== undefined) {
    f.push("assigned_to = ?");
    a.push(patch.assignedTo);
  }
  if (patch.followUpAt !== undefined) {
    f.push("follow_up_at = ?");
    a.push(patch.followUpAt ?? "");
  }
  if (patch.followUpNote !== undefined) {
    f.push("follow_up_note = ?");
    a.push(patch.followUpNote ?? "");
  }
  if (patch.lostReason !== undefined) {
    f.push("lost_reason = ?");
    a.push(patch.lostReason ?? "");
  }
  if (patch.actionCall !== undefined) {
    f.push("action_call = ?");
    a.push(patch.actionCall);
  }
  if (patch.whatsappSent !== undefined) {
    f.push("whatsapp_sent = ?");
    a.push(patch.whatsappSent);
  }
  if (patch.reminderSent !== undefined) {
    f.push("reminder_sent = ?");
    a.push(patch.reminderSent);
  }
  if (firstAction && firstAction !== prev.first_action_at) {
    f.push("first_action_at = ?");
    a.push(firstAction);
  }

  const q = `UPDATE leads SET ${f.join(", ")} WHERE id = ?`;
  a.push(id);
  d.prepare(q).run(...a);
  return { ok: true as const };
}
