import { getCellByLetter } from "./column-utils";
import type { SheetConfiguration } from "./sheet-config";
import { initialStatusFromSheetCell, type LeadStatus } from "./lead-status";
import type { StandardLeadRow } from "./types";

/**
 * Maps a raw row using admin column letters.
 */
export function mapRowWithConfiguration(
  row: string[],
  config: SheetConfiguration
): {
  campaign: string;
  name: string;
  phone: string;
  serviceRequired: string;
  existingStatusRaw: string;
  statusColumnMapped: boolean;
} {
  const c = config.columns;
  const statusLetter = (c.existingStatus ?? "").trim();
  const statusColumnMapped = statusLetter.length > 0;
  return {
    campaign: getCellByLetter(row, c.campaign),
    name: getCellByLetter(row, c.fullName),
    phone: getCellByLetter(row, c.phone),
    serviceRequired: getCellByLetter(row, c.serviceRequired),
    existingStatusRaw: statusColumnMapped ? getCellByLetter(row, statusLetter) : "",
    statusColumnMapped,
  };
}

export function resolveInitialStatus(
  existingStatusRaw: string,
  statusColumnMapped: boolean
): LeadStatus {
  return initialStatusFromSheetCell(existingStatusRaw, statusColumnMapped);
}

export function toStandardLead(m: {
  campaign: string;
  name: string;
  phone: string;
  serviceRequired: string;
}): StandardLeadRow {
  return {
    campaignData: m.campaign.trim(),
    fullName: m.name.trim(),
    phoneNumber: m.phone.trim(),
    serviceRequired: m.serviceRequired.trim(),
  };
}

export function rowLooksEmptyDynamic(lead: StandardLeadRow): boolean {
  const noPhone = !lead.phoneNumber.trim();
  const noName = !lead.fullName.trim();
  const noCamp = !lead.campaignData.trim();
  const noSvc = !lead.serviceRequired.trim();
  if (!noPhone) return false;
  return noName && noCamp && noSvc;
}
