/**
 * Single source of truth for lead status values, categories, and quick-filter buckets.
 * Add or change statuses here only.
 */

export const LEAD_STATUS = {
  NEW_LEAD: "New Lead",
  IN_PROGRESS: "In Progress",
  NO_ANSWER: "لم يتم الرد",
  INQUIRY: "استفسار",
  WILL_CALL_BACK: "he / she will call back",
  BOOKED: "تم الحجز",
  NOT_INTERESTED: "غير مهتم",
  PRICE_HIGH: "السعر غالي",
  SENT_MISTAKE: "ارسل الرقم بالغلط",
  WRONG_NUMBER: "الرقم غلط",
  OUT_OF_SERVICE: "خارج الخدمه",
} as const;

export type LeadStatus = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];

export const ALL_STATUSES: LeadStatus[] = [
  LEAD_STATUS.NEW_LEAD,
  LEAD_STATUS.IN_PROGRESS,
  LEAD_STATUS.NO_ANSWER,
  LEAD_STATUS.INQUIRY,
  LEAD_STATUS.WILL_CALL_BACK,
  LEAD_STATUS.BOOKED,
  LEAD_STATUS.NOT_INTERESTED,
  LEAD_STATUS.PRICE_HIGH,
  LEAD_STATUS.SENT_MISTAKE,
  LEAD_STATUS.WRONG_NUMBER,
  LEAD_STATUS.OUT_OF_SERVICE,
];

export type StatusCategory = "active" | "success" | "lost" | "invalid";

export const STATUS_CATEGORY: Record<LeadStatus, StatusCategory> = {
  [LEAD_STATUS.NEW_LEAD]: "active",
  [LEAD_STATUS.IN_PROGRESS]: "active",
  [LEAD_STATUS.NO_ANSWER]: "active",
  [LEAD_STATUS.INQUIRY]: "active",
  [LEAD_STATUS.WILL_CALL_BACK]: "active",
  [LEAD_STATUS.BOOKED]: "success",
  [LEAD_STATUS.NOT_INTERESTED]: "lost",
  [LEAD_STATUS.PRICE_HIGH]: "lost",
  [LEAD_STATUS.SENT_MISTAKE]: "invalid",
  [LEAD_STATUS.WRONG_NUMBER]: "invalid",
  [LEAD_STATUS.OUT_OF_SERVICE]: "invalid",
};

/** Tailwind class fragments for option chips (light + dark) */
export const CATEGORY_TAG_CLASS: Record<StatusCategory, string> = {
  active: "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-100 border-sky-200 dark:border-sky-800",
  success: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100 border-emerald-200 dark:border-emerald-800",
  lost: "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100 border-rose-200 dark:border-rose-800",
  invalid: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-600",
};

export const CATEGORY_ORDER: { category: StatusCategory; label: string; description: string }[] = [
  { category: "active", label: "Active / needs action", description: "Blue & yellow" },
  { category: "success", label: "Success", description: "Green" },
  { category: "lost", label: "Lost / rejected", description: "Red" },
  { category: "invalid", label: "Invalid / junk", description: "Gray" },
];

export const STATUSES_BY_CATEGORY: Record<StatusCategory, LeadStatus[]> = {
  active: [
    LEAD_STATUS.NEW_LEAD,
    LEAD_STATUS.IN_PROGRESS,
    LEAD_STATUS.NO_ANSWER,
    LEAD_STATUS.INQUIRY,
    LEAD_STATUS.WILL_CALL_BACK,
  ],
  success: [LEAD_STATUS.BOOKED],
  lost: [LEAD_STATUS.NOT_INTERESTED, LEAD_STATUS.PRICE_HIGH],
  invalid: [LEAD_STATUS.SENT_MISTAKE, LEAD_STATUS.WRONG_NUMBER, LEAD_STATUS.OUT_OF_SERVICE],
};

/** Quick filter tab → SQL bucket */
export type QuickFilterTab = "all" | "new" | "follow_up" | "won" | "lost" | "invalid";

export function statusesForTab(tab: QuickFilterTab): LeadStatus[] | "all" {
  if (tab === "all") return "all";
  if (tab === "new") return [LEAD_STATUS.NEW_LEAD, LEAD_STATUS.IN_PROGRESS];
  if (tab === "follow_up")
    return [LEAD_STATUS.IN_PROGRESS, LEAD_STATUS.NO_ANSWER, LEAD_STATUS.INQUIRY, LEAD_STATUS.WILL_CALL_BACK];
  if (tab === "won") return [LEAD_STATUS.BOOKED];
  if (tab === "lost") return [LEAD_STATUS.NOT_INTERESTED, LEAD_STATUS.PRICE_HIGH];
  if (tab === "invalid")
    return [LEAD_STATUS.SENT_MISTAKE, LEAD_STATUS.WRONG_NUMBER, LEAD_STATUS.OUT_OF_SERVICE];
  return "all";
}

export function isLeadStatus(s: string): s is LeadStatus {
  return ALL_STATUSES.includes(s as LeadStatus);
}

export function needsFollowUpFields(status: LeadStatus): boolean {
  return status === LEAD_STATUS.WILL_CALL_BACK;
}

export function needsLostReasonFields(status: LeadStatus): boolean {
  return status === LEAD_STATUS.NOT_INTERESTED || status === LEAD_STATUS.PRICE_HIGH;
}

export function isBookedStatus(status: LeadStatus): boolean {
  return status === LEAD_STATUS.BOOKED;
}

/** Map legacy DB values after migration */
const LEGACY_STATUS_MAP: Record<string, LeadStatus> = {
  New: LEAD_STATUS.NEW_LEAD,
  Calling: LEAD_STATUS.INQUIRY,
  Connected: LEAD_STATUS.BOOKED,
  Unreachable: LEAD_STATUS.NO_ANSWER,
  Dead: LEAD_STATUS.NOT_INTERESTED,
};

export function normalizeStatusFromDb(s: string): LeadStatus {
  if (isLeadStatus(s)) return s;
  return LEGACY_STATUS_MAP[s] ?? LEAD_STATUS.NEW_LEAD;
}

/**
 * When status column is mapped: blank cell → New Lead; otherwise map to a known `LeadStatus`
 * (exact/trim match, then legacy `normalizeStatusFromDb`, else New Lead for unknown text).
 * When status column is not mapped, always New Lead for **new** inserts (caller passes mapped=false only for that case).
 */
export function initialStatusFromSheetCell(raw: string, statusColumnMapped: boolean): LeadStatus {
  if (!statusColumnMapped) return LEAD_STATUS.NEW_LEAD;
  const t = raw.trim();
  if (!t) return LEAD_STATUS.NEW_LEAD;
  if (isLeadStatus(t)) return t;
  const n = normalizeStatusFromDb(t);
  if (n !== LEAD_STATUS.NEW_LEAD) return n;
  const low = t.toLowerCase();
  for (const s of ALL_STATUSES) {
    if (s.toLowerCase() === low) return s;
  }
  return LEAD_STATUS.NEW_LEAD;
}
