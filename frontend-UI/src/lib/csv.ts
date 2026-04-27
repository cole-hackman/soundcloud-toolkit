const DANGEROUS_CSV_PREFIX_RE = /^[=+\-@\t]/;

export function csvEscape(value: unknown) {
  const raw = value == null ? "" : String(value);
  const safe = DANGEROUS_CSV_PREFIX_RE.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  const csv = `\ufeff${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
