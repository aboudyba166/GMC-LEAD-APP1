"use client";

import { tryParseSheetConfiguration, type SheetConfiguration } from "./sheet-config";

/** Fired on `window` after connections are saved or cleared (same-tab; not a `storage` event). */
export const LCC_SHEET_CONFIG_CHANGED_EVENT = "lcc-sheet-config-changed";
import {
  SHEET_CONFIG_LAST_SAVED_AT_KEY,
  SHEET_CONFIG_STORAGE_KEY,
  SHEET_CONFIG_STORAGE_KEY_LEGACY_V1,
  SHEET_CONFIG_STORAGE_KEY_LEGACY_V2,
} from "./sheet-config";

export function loadSheetConfigurations(): SheetConfiguration[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SHEET_CONFIG_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(tryParseSheetConfiguration)
      .filter((x): x is SheetConfiguration => x !== null);
  } catch {
    return [];
  }
}

export function saveSheetConfigurations(configs: SheetConfiguration[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SHEET_CONFIG_STORAGE_KEY_LEGACY_V1);
    localStorage.removeItem(SHEET_CONFIG_STORAGE_KEY_LEGACY_V2);
    localStorage.setItem(SHEET_CONFIG_LAST_SAVED_AT_KEY, new Date().toISOString());
    // Explicitly stringify and set to ensure it overwrites correctly
    localStorage.setItem(SHEET_CONFIG_STORAGE_KEY, JSON.stringify(configs));
  } catch (e) {
    console.error("Failed to save to local storage", e);
  }
}

/** Remove v1/v2 keys so only v3 is used. */
export function removeLegacySheetConfigurationKey(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SHEET_CONFIG_STORAGE_KEY_LEGACY_V1);
    localStorage.removeItem(SHEET_CONFIG_STORAGE_KEY_LEGACY_V2);
  } catch {
    /* ignore */
  }
}

/** Clear v3 and legacy connection keys. */
export function clearAllSheetConfigurationsLocal(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SHEET_CONFIG_STORAGE_KEY);
    localStorage.removeItem(SHEET_CONFIG_STORAGE_KEY_LEGACY_V1);
    localStorage.removeItem(SHEET_CONFIG_STORAGE_KEY_LEGACY_V2);
    localStorage.removeItem(SHEET_CONFIG_LAST_SAVED_AT_KEY);
  } catch {
    /* ignore */
  }
}

/** For Admin UI: when connections were last saved in this browser. */
export function getLastSheetConfigSavedDisplay(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SHEET_CONFIG_LAST_SAVED_AT_KEY);
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleString();
  } catch {
    return null;
  }
}

