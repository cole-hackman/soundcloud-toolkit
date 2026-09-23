"use client";

import * as React from "react";
import { ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { fmtAbsolute, fmtInt, fmtMs, periodLong, timeAgo } from "../format";
import {
  Empty,
  ErrorNotice,
  Panel,
  RowSkeleton,
  Segmented,
  Select,
  SmallButton,
  StatusPill,
  TableShell,
  TextField,
  tdClass,
  thClass,
} from "../primitives";
import { useAdminOperations, useAdminStats } from "../queries";
import { DEFAULT_OPS_FILTER, OP_STATUSES, type OperationRow, type OperationsFilter, type Period } from "../types";
import { OperationDrawer } from "./OperationDrawer";

interface Props {
  period: Period;
  enabled: boolean;
  filter: OperationsFilter;
  onFilterChange: (next: OperationsFilter) => void;
}

const STATUS_OPTIONS = [
  { value: "all" as const, label: "All" },
  ...OP_STATUSES.map((s) => ({ value: s, label: s === "success" ? "OK" : s.charAt(0).toUpperCase() + s.slice(1) })),
];

const LIMIT_OPTIONS = [
  { value: "50" as const, label: "50" },
  { value: "100" as const, label: "100" },
];

export function OperationsView({ period, enabled, filter, onFilterChange }: Props) {
  // The text box updates instantly; the query only re-runs once typing pauses.
  const [searchInput, setSearchInput] = React.useState(filter.search);
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  React.useEffect(() => {
    if (debouncedSearch !== filter.search) onFilterChange({ ...filter, search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);
  // A filter set from elsewhere (an error code clicked on the overview) must
  // land in the box too.
  React.useEffect(() => {
    setSearchInput((current) => (current === filter.search ? current : filter.search));
  }, [filter.search]);

  const opsQ = useAdminOperations(period, filter, enabled);
  const statsQ = useAdminStats(period, enabled);
  const [selected, setSelected] = React.useState<OperationRow | null>(null);

  const ops = opsQ.data ?? [];
  const actions = statsQ.data?.featureUsage ?? [];
  const activeFilters = (filter.status !== "all" ? 1 : 0) + (filter.action ? 1 : 0) + (filter.search.trim() ? 1 : 0);
  const errorCount = ops.filter((o) => o.status === "error").length;

  const reset = () => {
    setSearchInput("");
    onFilterChange(DEFAULT_OPS_FILTER);
  };

  return (
    <div className="flex flex-col gap-4">
      <Panel
        index={0}
        title="Operation log"
        hint={`Newest first, ${periodLong(period)}. Page opens and read probes are excluded. Click a row to inspect it.`}
        padded={false}
        action={
          <span className="font-mono text-[11px] text-muted-foreground">
            {opsQ.isPending ? "Loading…" : `${fmtInt(ops.length)} shown${ops.length >= filter.limit ? " (limit)" : ""}${errorCount ? ` · ${errorCount} errors` : ""}`}
          </span>
        }
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 pb-3 sm:px-5">
          <label className="relative flex-1 basis-56">
            <span className="sr-only">Search by user, SoundCloud id, error code or message</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <TextField
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="User, SoundCloud id, error code or message…"
              className="w-full pl-8 pr-8"
            />
            {searchInput && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearchInput("")}
                className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </label>

          <Segmented size="sm" label="Status" options={STATUS_OPTIONS} value={filter.status} onChange={(status) => onFilterChange({ ...filter, status })} />

          <label className="flex items-center gap-1.5">
            <span className="sr-only">Action</span>
            <Select value={filter.action} onChange={(e) => onFilterChange({ ...filter, action: e.target.value })} className="max-w-[220px]">
              <option value="">Any action</option>
              {actions.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.name} ({fmtInt(a.count)})
                </option>
              ))}
              {filter.action && !actions.some((a) => a.key === filter.action) && <option value={filter.action}>{filter.action}</option>}
            </Select>
          </label>

          <Segmented
            size="sm"
            label="Rows"
            options={LIMIT_OPTIONS}
            value={String(filter.limit) as "50" | "100"}
            onChange={(v) => onFilterChange({ ...filter, limit: v === "100" ? 100 : 50 })}
          />

          {activeFilters > 0 && (
            <SmallButton onClick={reset} className="h-7">
              <X className="h-3 w-3" aria-hidden="true" /> Clear {activeFilters}
            </SmallButton>
          )}
        </div>

        <div className="px-4 pt-3 sm:px-5">
          {opsQ.isError ? (
            <ErrorNotice message={opsQ.error.message || "Could not load operations."} onRetry={() => opsQ.refetch()} />
          ) : opsQ.isPending ? (
            <RowSkeleton rows={10} />
          ) : ops.length === 0 ? (
            <Empty className="mb-4">No operations match these filters in the {periodLong(period)}.</Empty>
          ) : (
            <TableShell minWidth={760} className={cn(opsQ.isPlaceholderData && "opacity-60 transition-opacity")}>
              <thead>
                <tr>
                  <th scope="col" className={thClass}>When</th>
                  <th scope="col" className={thClass}>User</th>
                  <th scope="col" className={thClass}>Action</th>
                  <th scope="col" className={cn(thClass, "text-right")}>Items</th>
                  <th scope="col" className={cn(thClass, "text-right")}>Latency</th>
                  <th scope="col" className={thClass}>Status</th>
                  <th scope="col" className={thClass}>Detail</th>
                  <th scope="col" className={cn(thClass, "w-8")}>
                    <span className="sr-only">Inspect</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ops.map((op) => {
                  const items = op.trackCount || op.itemCount || 0;
                  return (
                    <tr
                      key={op.id}
                      onClick={() => setSelected(op)}
                      className={cn(
                        "group cursor-pointer transition-colors hover:bg-primary/[0.06]",
                        op.status === "error" && "bg-destructive/[0.04]",
                      )}
                    >
                      <td className={cn(tdClass, "whitespace-nowrap font-mono text-[11px] text-muted-foreground")} title={fmtAbsolute(op.createdAt)}>
                        {timeAgo(op.createdAt)}
                      </td>
                      <td className={cn(tdClass, "max-w-[160px] truncate font-mono text-[12px] font-medium text-primary-text")} title={op.user.displayName ?? undefined}>
                        @{op.user.username}
                      </td>
                      <td className={cn(tdClass, "max-w-[220px] truncate text-foreground/90")}>{op.actionName}</td>
                      <td className={cn(tdClass, "text-right font-mono tabular-nums text-foreground")}>{items ? fmtInt(items) : <span className="text-muted-foreground">—</span>}</td>
                      <td className={cn(tdClass, "text-right font-mono tabular-nums text-muted-foreground")}>{fmtMs(op.durationMs)}</td>
                      <td className={tdClass}>
                        <StatusPill status={op.status} />
                      </td>
                      <td className={cn(tdClass, "max-w-[260px] truncate font-mono text-[11px]", op.errorCode || op.errorMessage ? "text-destructive-text" : "text-muted-foreground")} title={op.errorMessage ?? undefined}>
                        {op.errorCode || op.errorMessage || ""}
                      </td>
                      <td className={cn(tdClass, "text-right")}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(op);
                          }}
                          aria-label={`Inspect ${op.actionName} by @${op.user.username}`}
                          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground group-hover:text-foreground"
                        >
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
          )}
        </div>
      </Panel>

      <OperationDrawer
        op={selected}
        onClose={() => setSelected(null)}
        onFilterUser={(username) => {
          setSelected(null);
          setSearchInput(username);
        }}
      />
    </div>
  );
}
