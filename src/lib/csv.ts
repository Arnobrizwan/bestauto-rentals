/**
 * Minimal RFC 4180 CSV serialisation.
 *
 * Written out rather than pulled in because the whole job is quoting. The rule
 * that matters for this data: a Bangladeshi address or an AI summary will
 * contain commas and quotes, and a lead message can contain a newline — all
 * three have to survive, and a field containing a quote doubles it.
 */
function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(columns: { key: string; label: string }[], rows: Record<string, unknown>[]) {
  const header = columns.map((c) => cell(c.label)).join(",");
  const body = rows.map((row) => columns.map((c) => cell(row[c.key])).join(","));
  // A trailing newline, so appending in a shell or a spreadsheet behaves.
  return [header, ...body].join("\r\n") + "\r\n";
}

/** `Content-Disposition` for a download, with the date in the filename. */
export function csvHeaders(name: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="bestauto-${name}-${stamp}.csv"`,
    "cache-control": "no-store",
  };
}
