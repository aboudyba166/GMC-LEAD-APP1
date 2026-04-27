import type { LeadStatus } from "./lead-status";

export type { LeadStatus } from "./lead-status";

export type StandardLeadRow = {
  campaignData: string;
  fullName: string;
  phoneNumber: string;
  serviceRequired: string;
};

export type YesNo = "yes" | "no" | "";

export type LeadRecord = StandardLeadRow & {
  id: string;
  phoneKey: string;
  status: LeadStatus;
  assignedTo: string;
  sourceId: string;
  /** 1-based row in the Google Sheet tab (newest entries are lower rows in UI = higher number). */
  sourceRow: number | null;
  createdAt: string;
  /** When the lead was first ingested (sync) */
  fetchedAt: string;
  /** First time an agent took action (status, follow-up, note, or action fields) */
  firstActionAt: string | null;
  /** Any update to the lead record */
  lastUpdatedAt: string;
  followUpAt: string | null;
  followUpNote: string | null;
  lostReason: string | null;
  /** 1st action — e.g. call log */
  actionCall: string;
  whatsappSent: YesNo;
  reminderSent: YesNo;
  /** Detailed notes for in-progress leads */
  notes: string | null;
  /** Last time an agent took a specific action */
  lastActionAt: string | null;
};
