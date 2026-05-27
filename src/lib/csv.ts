// Tiny CSV helpers. No deps. Safe to import in either client or server code,
// but `downloadCSV` uses `document` + `Blob` and therefore only runs in the
// browser (call it from a "use client" component's event handler).

export type CsvColumn<T> = {
  label: string;
  get: (row: T) => unknown;
};

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "number" ? String(v) : String(v);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function toCSV<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => csvEscape(c.label)).join(",");
  const body = rows.map((r) =>
    columns.map((c) => csvEscape(c.get(r))).join(","),
  );
  // CRLF and a UTF-8 BOM-friendly format; Excel and Google Sheets both accept.
  return [header, ...body].join("\r\n") + "\r\n";
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function downloadCSV(filename: string, csv: string): void {
  // Prepend BOM so Excel auto-detects UTF-8 instead of Latin-1, which would
  // mojibake any non-ASCII issuer names.
  const BOM = "﻿";
  const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so very fast browsers don't kill the URL before the download
  // dialog opens.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
