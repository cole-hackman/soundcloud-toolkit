"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { fmtCompact, fmtInt } from "./format";
import { TONE_BG, TONE_TEXT, type Tone } from "./primitives";
import type { DailyPoint } from "./types";

/* ── Measure the container so charts stay crisp at any width ───────────── */

export function useElementWidth<T extends HTMLElement>(fallback = 600) {
  const ref = React.useRef<T | null>(null);
  const [width, setWidth] = React.useState(fallback);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && Math.abs(w - width) > 1) setWidth(w);
    });
    ro.observe(el);
    setWidth(el.getBoundingClientRect().width || fallback);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [ref, width] as const;
}

/* ── Sparkline ─────────────────────────────────────────────────────────── */

export function Sparkline({
  values,
  width = 96,
  height = 30,
  className,
  filled = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
  filled?: boolean;
}) {
  const id = React.useId();
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg aria-hidden="true" width={width} height={height} className={cn("block overflow-visible", className)}>
      {filled && (
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {filled && <path d={area} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="2.4" fill="currentColor" />
    </svg>
  );
}

/* ── Trend chart with hover + keyboard ─────────────────────────────────── */

export type TrendMetric = keyof Omit<DailyPoint, "date">;

interface TrendChartProps {
  data: DailyPoint[];
  metric: TrendMetric;
  label: string;
  tone?: Tone;
  height?: number;
}

export function TrendChart({ data, metric, label, tone = "primary", height = 220 }: TrendChartProps) {
  const [wrapRef, width] = useElementWidth<HTMLDivElement>(640);
  const [hover, setHover] = React.useState<number | null>(null);
  const gradientId = React.useId();

  const values = React.useMemo(() => data.map((d) => Number(d[metric]) || 0), [data, metric]);
  const total = values.reduce((a, b) => a + b, 0);
  const peakIndex = values.length ? values.indexOf(Math.max(...values)) : -1;

  if (data.length === 0) {
    return <div className="flex items-center justify-center font-mono text-[12px] text-muted-foreground" style={{ height }}>No activity in this window.</div>;
  }

  const padL = 44;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const cw = Math.max(width - padL - padR, 40);
  const ch = height - padT - padB;
  const max = Math.max(...values, 1) * 1.12;
  const n = values.length;
  const xFor = (i: number) => padL + (n === 1 ? cw / 2 : (i / (n - 1)) * cw);
  const yFor = (v: number) => padT + ch - (v / max) * ch;

  const pts = values.map((v, i) => ({ x: xFor(i), y: yFor(v) }));
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[n - 1].x.toFixed(1)},${(padT + ch).toFixed(1)} L${pts[0].x.toFixed(1)},${(padT + ch).toFixed(1)} Z`;

  const gridSteps = 4;
  const grid = Array.from({ length: gridSteps + 1 }, (_, i) => Math.round((max / gridSteps) * i));

  // At most ~6 x labels, always including the first and last day.
  const labelEvery = Math.max(Math.ceil(n / 6), 1);
  const xLabels = data
    .map((d, i) => ({ i, d }))
    .filter(({ i }) => i === 0 || i === n - 1 || (i % labelEvery === 0 && n - 1 - i >= labelEvery / 2));

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const rel = (x - padL) / cw;
    const idx = Math.round(Math.min(Math.max(rel, 0), 1) * (n - 1));
    setHover(idx);
  };

  const onKey = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setHover((h) => Math.min((h ?? -1) + 1, n - 1));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      setHover((h) => Math.max((h ?? n) - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setHover(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHover(n - 1);
    } else if (e.key === "Escape") {
      setHover(null);
    }
  };

  const h = hover != null ? { i: hover, ...pts[hover], v: values[hover], d: data[hover] } : null;
  const tipLeft = h ? Math.min(Math.max(h.x, padL + 60), width - 70) : 0;

  const summary = `${label} per day, ${n} day${n === 1 ? "" : "s"}, total ${fmtInt(total)}` +
    (peakIndex >= 0 ? `, peak ${fmtInt(values[peakIndex])} on ${data[peakIndex].date}` : "") +
    ". Use arrow keys to inspect a day.";

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={summary}
        tabIndex={0}
        className={cn("block touch-none select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/60", TONE_TEXT[tone])}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {grid.map((gv, i) => {
          const y = yFor(gv);
          return (
            <g key={i} className="text-border">
              <line x1={padL} x2={width - padR} y1={y} y2={y} stroke="currentColor" strokeWidth="1" strokeDasharray={i === 0 ? undefined : "2 4"} />
              <text x={padL - 8} y={y + 3.5} textAnchor="end" className="fill-muted-foreground font-mono" fontSize="10">
                {fmtCompact(gv)}
              </text>
            </g>
          );
        })}

        {xLabels.map(({ i, d }) => (
          <text
            key={i}
            x={xFor(i)}
            y={height - 8}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            className="fill-muted-foreground font-mono"
            fontSize="10"
          >
            {d.date}
          </text>
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {n === 1 && <circle cx={pts[0].x} cy={pts[0].y} r="4" fill="currentColor" />}

        {h && (
          <g>
            <line x1={h.x} x2={h.x} y1={padT} y2={padT + ch} stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
            <circle cx={h.x} cy={h.y} r="4.5" className="fill-card" stroke="currentColor" strokeWidth="2" />
          </g>
        )}
      </svg>

      {h && (
        <div
          role="status"
          className="pointer-events-none absolute top-1 -translate-x-1/2 rounded-md border border-border/80 bg-popover px-2.5 py-1.5 text-center shadow-md"
          style={{ left: tipLeft }}
        >
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{h.d.date}</div>
          <div className="font-display text-base font-semibold tabular-nums leading-tight text-foreground">
            {fmtInt(h.v)} <span className="font-mono text-[10px] font-normal text-muted-foreground">{label.toLowerCase()}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Stacked outcome bar ───────────────────────────────────────────────── */

export interface OutcomeSegment {
  key: string;
  label: string;
  pct: number;
  count?: number | null;
  tone: Tone;
}

export function OutcomeBar({ segments }: { segments: OutcomeSegment[] }) {
  const total = segments.reduce((a, s) => a + Math.max(s.pct, 0), 0) || 1;
  return (
    <div>
      <div
        role="img"
        aria-label={segments.map((s) => `${s.label} ${Math.round(s.pct)}%`).join(", ")}
        className="flex h-3 w-full overflow-hidden rounded-full bg-muted/60"
      >
        {segments.map((s) =>
          s.pct > 0 ? (
            <div
              key={s.key}
              className={cn("h-full transition-[width] duration-700 ease-out", TONE_BG[s.tone])}
              style={{ width: `${(s.pct / total) * 100}%` }}
              title={`${s.label}: ${Math.round(s.pct)}%`}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {segments.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <span aria-hidden="true" className={cn("h-2 w-2 shrink-0 rounded-full", TONE_BG[s.tone])} />
            <span className="min-w-0">
              <span className="block font-mono text-[12px] font-semibold tabular-nums text-foreground">
                {Math.round(s.pct)}%
                {s.count != null && <span className="ml-1 font-normal text-muted-foreground">({fmtInt(s.count)})</span>}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{s.label}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
