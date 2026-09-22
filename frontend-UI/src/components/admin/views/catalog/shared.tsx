"use client";

import * as React from "react";
import { Download, X } from "lucide-react";
import { fmtInt } from "../../format";
import { SmallButton, TextField } from "../../primitives";
import { CATALOG_PAGE_SIZE } from "../../queries";

/** Page N of M with prev/next; hidden when there is nothing to page. */
export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (page: number) => void }) {
  const totalPages = Math.max(Math.ceil(total / CATALOG_PAGE_SIZE), 1);
  if (total <= 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-3">
      <span className="font-mono text-[11px] text-muted-foreground">
        Page {page} of {fmtInt(totalPages)} · {CATALOG_PAGE_SIZE} per page
      </span>
      <div className="flex gap-1.5">
        <SmallButton className="h-7" disabled={page <= 1} onClick={() => onPage(Math.max(page - 1, 1))}>
          ← Prev
        </SmallButton>
        <SmallButton className="h-7" disabled={page >= totalPages} onClick={() => onPage(Math.min(page + 1, totalPages))}>
          Next →
        </SmallButton>
      </div>
    </div>
  );
}

/** Plain anchor to the CSV endpoint: the browser downloads with the session cookie. */
export function ExportLink({ href, label = "Export CSV", title }: { href: string; label?: string; title?: string }) {
  return (
    <a
      href={href}
      title={title ?? "Download the current filter set as CSV (up to 10,000 rows)"}
      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 font-mono text-[12px] font-medium text-foreground hover:bg-accent"
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" /> {label}
    </a>
  );
}

/** Search box with a clear button; the parent debounces. */
export function SearchBox({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <label className={className ?? "relative flex-1 basis-40"}>
      <span className="sr-only">{label}</span>
      <TextField value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full pr-7" />
      {value && (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()}`}
          onClick={() => onChange("")}
          className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </label>
  );
}

/** Column visibility toggles rendered as small pressed buttons. */
export function ColumnToggles<K extends string>({
  columns,
  visible,
  onToggle,
}: {
  columns: ReadonlyArray<{ key: K; label: string }>;
  visible: ReadonlySet<K>;
  onToggle: (key: K) => void;
}) {
  return (
    <div role="group" aria-label="Optional columns" className="flex items-center gap-1">
      <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Columns</span>
      {columns.map((c) => {
        const on = visible.has(c.key);
        return (
          <button
            key={c.key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(c.key)}
            className={
              on
                ? "h-6 rounded-md border border-primary/50 bg-primary/10 px-2 font-mono text-[11px] text-primary"
                : "h-6 rounded-md border border-border/70 px-2 font-mono text-[11px] text-muted-foreground hover:text-foreground"
            }
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

export function useToggleSet<K extends string>(initial: K[] = []) {
  const [set, setSet] = React.useState<Set<K>>(() => new Set(initial));
  const toggle = React.useCallback((key: K) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);
  return [set, toggle] as const;
}
