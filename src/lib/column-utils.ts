/**
 * 0-based column index for a letter in A–ZZ…
 */
export function columnLetterToIndex(letter: string): number {
  const s = letter.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(s)) {
    throw new Error(`Invalid column letter: ${letter}`);
  }
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    n = n * 26 + (s.charCodeAt(i) - 64);
  }
  return n - 1;
}

/** 0-based index back to A1 column letters (0 → A, 25 → Z, 26 → AA). */
export function indexToColumnLetter0(index0: number): string {
  if (index0 < 0) throw new Error("Invalid column index");
  let n = index0 + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/**
 * Widen a row array so indices up to `maxIndex` are addressable.
 */
function padRow(row: string[], maxIndex: number): string[] {
  const r = row.slice();
  while (r.length <= maxIndex) r.push("");
  return r;
}

/**
 * Get cell at column letter (0-based A=0) from a sparse row.
 */
export function getCellByLetter(row: string[], letter: string): string {
  if (!letter || !String(letter).trim()) return "";
  if (row.length === 0) return "";
  const idx = columnLetterToIndex(letter);
  const padded = padRow(row, idx);
  return (padded[idx] ?? "").trim();
}
