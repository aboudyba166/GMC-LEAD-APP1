/**
 * Normalized phone for duplicate detection. Strips to digits only;
 * for empty / too-short strings returns empty (caller should treat as not dedupe-able).
 */
export function normalizePhoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 5) return "";
  return digits;
}
