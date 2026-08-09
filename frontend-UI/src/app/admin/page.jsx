"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";
const REFRESH_MS = 30_000;
const ADMIN_THEME_KEY = "sc-admin-theme";

/** Default palette for chart helpers when `palette` is omitted (dark). */
const PALETTES = {
  dark: {
    bg: "#0D0D0F",
    card: "#141417",
    cardBorder: "#1E1E23",
    text: "#E8E6E1",
    textDim: "#6B6A67",
    textMid: "#9A9893",
    orangeDim: "rgba(255,85,0,0.15)",
    segmentBg: "#1E1E23",
  },
  light: {
    bg: "#EEEEF2",
    card: "#FFFFFF",
    cardBorder: "#DCDCE2",
    text: "#111827",
    textDim: "#6B7280",
    textMid: "#4B5563",
    orangeDim: "rgba(255,85,0,0.12)",
    segmentBg: "#E4E4EA",
  },
};

const ORANGE = "#FF5500";
const GREEN = "#2ECC71";
const RED = "#E74C3C";
const YELLOW = "#F1C40F";
const CYAN = "#00D4AA";

// --- SVG Chart Components ---

function SparklineChart({ data, color = ORANGE, width = 200, height = 48, filled = false }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));
  const pathD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const fillD = pathD + ` L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      {filled && (
        <defs>
          <linearGradient id={`fill-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}
      {filled && <path d={fillD} fill={`url(#fill-${color.replace("#", "")})`} />}
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5" fill={color} />
    </svg>
  );
}

function AreaChart({ data, dataKey, color = ORANGE, width = 600, height = 180, palette }) {
  const P = palette ?? PALETTES.dark;
  if (!data || data.length === 0) {
    return <div style={{ height, background: P.cardBorder, borderRadius: 6, opacity: 0.35 }} />;
  }
  const values = data.map((d) => d[dataKey] || 0);
  const max = Math.max(...values, 1) * 1.1;
  const padL = 50, padR = 16, padT = 12, padB = 28;
  const cw = width - padL - padR;
  const ch = height - padT - padB;

  const pts = values.map((v, i) => ({
    x: padL + (i / Math.max(values.length - 1, 1)) * cw,
    y: padT + ch - (v / max) * ch,
  }));
  const lineD = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaD = lineD + ` L${pts[pts.length - 1].x},${padT + ch} L${pts[0].x},${padT + ch} Z`;

  const gridLines = 4;
  const gridVals = Array.from({ length: gridLines + 1 }, (_, i) => Math.round((max / gridLines) * i));

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id={`area-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {gridVals.map((gv, i) => {
        const y = padT + ch - (gv / max) * ch;
        return (
          <g key={i}>
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={P.cardBorder} strokeWidth="1" />
            <text x={padL - 8} y={y + 4} textAnchor="end" fill={P.textDim} fontSize="10" fontFamily="'JetBrains Mono', monospace">
              {gv >= 1000 ? `${(gv / 1000).toFixed(1)}k` : gv}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        if (i % Math.max(Math.floor(data.length / 7), 1) !== 0 && i !== data.length - 1) return null;
        const x = padL + (i / Math.max(data.length - 1, 1)) * cw;
        return (
          <text key={i} x={x} y={height - 4} textAnchor="middle" fill={P.textDim} fontSize="9" fontFamily="'JetBrains Mono', monospace">
            {d.date}
          </text>
        );
      })}
      <path d={areaD} fill={`url(#area-${dataKey})`} />
      <path d={lineD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.slice(-1).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={P.bg} stroke={color} strokeWidth="2" />
      ))}
    </svg>
  );
}

function HBar({ items, palette }) {
  const P = palette ?? PALETTES.dark;
  if (!items || items.length === 0) {
    return <div style={{ height: 120, background: P.cardBorder, borderRadius: 6, opacity: 0.35 }} />;
  }
  const m = Math.max(...items.map((i) => i.count), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item) => (
        <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 110, fontSize: 12, color: P.textMid, fontFamily: "'JetBrains Mono', monospace", textAlign: "right", flexShrink: 0 }}>
            {item.name}
          </span>
          <div style={{ flex: 1, height: 22, background: `${item.color}10`, borderRadius: 4, overflow: "hidden", position: "relative" }}>
            <div
              style={{
                height: "100%",
                width: `${(item.count / m) * 100}%`,
                background: `linear-gradient(90deg, ${item.color}30, ${item.color}90)`,
                borderRadius: 4,
                transition: "width 1.2s cubic-bezier(0.22,1,0.36,1)",
              }}
            />
          </div>
          <div style={{ width: 90, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 13, color: P.text, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
              {item.count.toLocaleString()}
            </span>
            {item.avgDurationMs ? (
              <span style={{ fontSize: 10, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
                {item.avgDurationMs}ms
              </span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, trend, trendDir, spark, sparkColor, delay = 0, palette }) {
  const P = palette ?? PALETTES.dark;
  return (
    <div
      style={{
        background: P.card,
        border: `1px solid ${P.cardBorder}`,
        borderRadius: 10,
        padding: "20px 22px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        animation: `fadeSlideUp 0.6s ${delay}s both cubic-bezier(0.22,1,0.36,1)`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 11, color: P.textDim, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 1.2 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: P.text, fontFamily: "'Outfit', sans-serif", marginTop: 4, lineHeight: 1 }}>{value}</div>
        </div>
        {spark && spark.length >= 2 && (
          <div style={{ marginTop: 8 }}>
            <SparklineChart data={spark} color={sparkColor || ORANGE} width={90} height={36} filled />
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
        {trend && (
          <span
            style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600,
              color: trendDir === "up" ? GREEN : trendDir === "down" ? RED : P.textDim,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            {trendDir === "up" ? "▲" : trendDir === "down" ? "▼" : "—"} {trend}
          </span>
        )}
        {sub && <span style={{ fontSize: 11, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{sub}</span>}
      </div>
    </div>
  );
}

function SectionCard({ title, children, span = 1, delay = 0, style: s, palette, action }) {
  const P = palette ?? PALETTES.dark;
  return (
    <div
      style={{
        background: P.card,
        border: `1px solid ${P.cardBorder}`,
        borderRadius: 10,
        padding: "20px 22px",
        gridColumn: `span ${span}`,
        animation: `fadeSlideUp 0.6s ${delay}s both cubic-bezier(0.22,1,0.36,1)`,
        display: "flex",
        flexDirection: "column",
        ...s,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: P.textDim,
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: "uppercase",
          letterSpacing: 1.2,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ width: 4, height: 4, borderRadius: "50%", background: ORANGE, display: "inline-block" }} />
        <span style={{ flex: 1 }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function StatusPill({ status }) {
  const config = {
    success: { bg: `${GREEN}18`, color: GREEN, label: "OK" },
    split: { bg: `${YELLOW}18`, color: YELLOW, label: "SPLIT" },
    error: { bg: `${RED}18`, color: RED, label: "ERR" },
    partial: { bg: `${ORANGE}18`, color: ORANGE, label: "PARTIAL" },
  };
  // Unknown statuses render as themselves in gray — never as a false "OK".
  const c = config[status] || { bg: "#94A3B818", color: "#94A3B8", label: String(status || "?").toUpperCase().slice(0, 8) };
  return (
    <span
      style={{
        fontSize: 9,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 700,
        color: c.color,
        background: c.bg,
        padding: "2px 7px",
        borderRadius: 4,
        letterSpacing: 0.8,
      }}
    >
      {c.label}
    </span>
  );
}

function Donut({ value, max, color = ORANGE, label, size = 96, palette }) {
  const P = palette ?? PALETTES.dark;
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(value / max, 1);
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} style={{ display: "block", margin: "0 auto" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={P.cardBorder} strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.22,1,0.36,1)" }}
        />
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central" fill={P.text} fontSize="18" fontWeight="700" fontFamily="'Outfit', sans-serif">
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <div style={{ fontSize: 10, color: P.textDim, fontFamily: "'JetBrains Mono', monospace", marginTop: 6 }}>{label}</div>
    </div>
  );
}

function FeedbackBreakdown({ title, counts, total, order, labels, colors, palette }) {
  const P = palette ?? PALETTES.dark;
  const safeTotal = Math.max(total, 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 10, color: P.textDim, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 0.8 }}>
        {title}
      </div>
      {order.map(key => {
        const count = counts[key] || 0;
        const pct = Math.round((count / safeTotal) * 100);
        const color = colors[key] || P.textMid;
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: P.textMid, fontFamily: "'JetBrains Mono', monospace", width: 110, flexShrink: 0 }}>
              {labels[key] || key}
            </span>
            <div style={{ flex: 1, height: 6, background: P.cardBorder, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.3s" }} />
            </div>
            <span style={{ fontSize: 11, color: P.text, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, width: 60, textAlign: "right" }}>
              {count} <span style={{ color: P.textDim, fontWeight: 400 }}>({pct}%)</span>
            </span>
          </div>
        );
      })}
      <div style={{ fontSize: 10, color: P.textDim, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>
        {total} response{total === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function SkeletonBlock({ height = 60, palette }) {
  const P = palette ?? PALETTES.dark;
  return (
    <div
      style={{
        height,
        background: P.cardBorder,
        borderRadius: 6,
        opacity: 0.5,
        animation: "skeleton-pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Card subs read "{period} period" / "{period} active" for relative windows,
// but "all period" / "all active" don't parse as English — special-case it.
function periodSub(period, word = "period") {
  return period === "all" ? "All time" : `${period} ${word}`;
}

function periodTitleLabel(period) {
  return period === "all" ? "All Time" : period;
}

// --- Music Catalog Section ---
const CATALOG_TRACK_ACTIONS = [
  "merge", "from-likes", "bulk-unlike", "bulk-like", "clone", "genre-search",
  "library-audit", "playlist-compare", "resolve", "batch-resolve",
  "bulk-remove-reposts", "proxy-download",
];

const CATALOG_SORTABLE = new Set(["title", "artist", "touches", "users", "lastTouched"]);

function catalogSelectStyle(P) {
  return {
    fontSize: 10,
    fontFamily: "'JetBrains Mono', monospace",
    color: P.text,
    background: P.card,
    border: `1px solid ${P.cardBorder}`,
    borderRadius: 6,
    padding: "4px 6px",
  };
}

function MusicCatalogSection({ period, palette: P }) {
  const [summary, setSummary] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("touches");
  const [order, setOrder] = useState("desc");
  const [genre, setGenre] = useState("");
  const [artistInput, setArtistInput] = useState("");
  const [artist, setArtist] = useState("");
  const [access, setAccess] = useState("");
  const [resolveStatus, setResolveStatus] = useState("");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedTrack, setExpandedTrack] = useState(null);
  const [trackOps, setTrackOps] = useState({});
  const pageSize = 25;

  // Debounce the artist text filter
  useEffect(() => {
    const t = setTimeout(() => {
      setArtist(artistInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [artistInput]);

  useEffect(() => {
    fetch(`${API_BASE}/api/admin/catalog/summary?period=${period}`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [period]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ period, page: String(page), pageSize: String(pageSize), sort, order });
    if (genre) params.set("genre", genre);
    if (artist) params.set("artist", artist);
    if (access) params.set("access", access);
    if (resolveStatus) params.set("resolveStatus", resolveStatus);
    if (action) params.set("action", action);
    fetch(`${API_BASE}/api/admin/catalog/tracks?${params}`, { credentials: "include" })
      .then(r => (r.ok ? r.json() : { tracks: [], total: 0 }))
      .then(data => {
        setTracks(data.tracks || []);
        setTotal(data.total || 0);
      })
      .catch(() => {
        setTracks([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [period, page, sort, order, genre, artist, access, resolveStatus, action]);

  const toggleSort = (key) => {
    if (!CATALOG_SORTABLE.has(key)) return;
    if (sort === key) setOrder(order === "desc" ? "asc" : "desc");
    else {
      setSort(key);
      setOrder(key === "title" || key === "artist" ? "asc" : "desc");
    }
    setPage(1);
  };

  const toggleDrilldown = (trackId) => {
    if (expandedTrack === trackId) {
      setExpandedTrack(null);
      return;
    }
    setExpandedTrack(trackId);
    if (!trackOps[trackId]) {
      fetch(`${API_BASE}/api/admin/catalog/tracks/${trackId}/operations`, { credentials: "include" })
        .then(r => (r.ok ? r.json() : { operations: [] }))
        .then(data => setTrackOps(prev => ({ ...prev, [trackId]: data.operations || [] })))
        .catch(() => setTrackOps(prev => ({ ...prev, [trackId]: [] })));
    }
  };

  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const accessCounts = summary?.accessBreakdown ?? {};
  const unresolved = Object.entries(summary?.resolveBreakdown ?? {})
    .filter(([k]) => k !== "resolved")
    .reduce((acc, [, v]) => acc + v, 0);
  const notPlayable = (accessCounts.blocked ?? 0) + (accessCounts.preview ?? 0) + (accessCounts.gone ?? 0);
  const mono = { fontFamily: "'JetBrains Mono', monospace" };

  return (
    <div style={{ marginTop: 20 }}>
      <SectionCard title={`Music Catalog — ${periodTitleLabel(period)} Touches`} delay={0.5} palette={P}>
        {/* Aggregate summary tiles — the default view; user identity only via drill-down */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 14 }}>
          {[
            { label: "Tracks", value: summary?.totalTracks, color: P.text },
            { label: "Artists", value: summary?.totalArtists, color: CYAN },
            { label: "Playlists", value: summary?.totalPlaylists, color: P.text },
            { label: "Touches (period)", value: summary?.periodTouchEvents, color: ORANGE },
            { label: "Unresolved", value: unresolved, color: YELLOW },
            { label: "Blocked / preview / gone", value: notPlayable, color: RED },
          ].map(m => (
            <div key={m.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: m.color, fontFamily: "'Outfit', sans-serif" }}>
                {m.value == null ? "—" : Number(m.value).toLocaleString()}
              </div>
              <div style={{ ...mono, fontSize: 9, color: P.textDim, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.6 }}>
                {m.label}
              </div>
            </div>
          ))}
        </div>

        {/* Genre + access breakdowns, gaps included */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 14 }}>
          <div>
            <div style={{ ...mono, fontSize: 9, color: P.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
              Genres (top 12, incl. missing)
            </div>
            <HBar
              items={(summary?.genreBreakdown ?? []).map(g => ({
                key: g.genre,
                name: g.genre,
                count: g.count,
                color: g.genre === "(none)" ? YELLOW : CYAN,
              }))}
              palette={P}
            />
          </div>
          <div>
            <div style={{ ...mono, fontSize: 9, color: P.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
              Access status
            </div>
            <HBar
              items={Object.entries(accessCounts).map(([k, v]) => ({
                key: k,
                name: k,
                count: v,
                color: k === "playable" ? GREEN : k === "unknown" ? P.textDim : RED,
              }))}
              palette={P}
            />
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <select value={genre} onChange={e => { setGenre(e.target.value); setPage(1); }} style={catalogSelectStyle(P)}>
            <option value="">All genres</option>
            {(summary?.genreBreakdown ?? []).map(g => (
              <option key={g.genre} value={g.genre}>{g.genre}</option>
            ))}
          </select>
          <select value={access} onChange={e => { setAccess(e.target.value); setPage(1); }} style={catalogSelectStyle(P)}>
            <option value="">All access</option>
            {["playable", "preview", "blocked", "gone", "unknown"].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select value={resolveStatus} onChange={e => { setResolveStatus(e.target.value); setPage(1); }} style={catalogSelectStyle(P)}>
            <option value="">All resolve states</option>
            {["resolved", "pending", "not_found", "gone"].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select value={action} onChange={e => { setAction(e.target.value); setPage(1); }} style={catalogSelectStyle(P)}>
            <option value="">Any action</option>
            {CATALOG_TRACK_ACTIONS.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <input
            value={artistInput}
            onChange={e => setArtistInput(e.target.value)}
            placeholder="Filter by artist…"
            style={{ ...catalogSelectStyle(P), width: 150 }}
          />
        </div>

        {/* Track table */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} height={32} palette={P} />)}
          </div>
        ) : tracks.length === 0 ? (
          <div style={{ ...mono, textAlign: "center", padding: "28px 0", color: P.textDim, fontSize: 12 }}>
            No catalog tracks match these filters yet. The catalog fills as operations run.
          </div>
        ) : (
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.3fr 1fr 0.8fr 0.6fr 0.5fr 0.8fr 0.8fr",
                gap: 8,
                padding: "0 8px 8px",
                borderBottom: `1px solid ${P.cardBorder}`,
                marginBottom: 4,
              }}
            >
              {[
                ["title", "Track"], ["artist", "Artist"], ["genre", "Genre"], ["access", "Access"],
                ["touches", "Touches"], ["users", "Users"], ["lastTouched", "Last touched"], ["resolve", "Resolve"],
              ].map(([key, label]) => (
                <span
                  key={key}
                  onClick={() => toggleSort(key)}
                  style={{
                    ...mono,
                    fontSize: 9,
                    color: sort === key ? ORANGE : P.textDim,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    cursor: CATALOG_SORTABLE.has(key) ? "pointer" : "default",
                    userSelect: "none",
                  }}
                >
                  {label}{sort === key ? (order === "desc" ? " ↓" : " ↑") : ""}
                </span>
              ))}
            </div>
            {tracks.map((t, i) => (
              <div key={String(t.id)}>
                <div
                  onClick={() => toggleDrilldown(t.id)}
                  title="Click for the operations that touched this track"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.3fr 1fr 0.8fr 0.6fr 0.5fr 0.8fr 0.8fr",
                    gap: 8,
                    padding: "8px",
                    borderRadius: 6,
                    borderBottom: i < tracks.length - 1 ? `1px solid ${P.cardBorder}33` : "none",
                    alignItems: "center",
                    cursor: "pointer",
                    background: expandedTrack === t.id ? `${ORANGE}0D` : "transparent",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = `${ORANGE}0D`}
                  onMouseLeave={e => e.currentTarget.style.background = expandedTrack === t.id ? `${ORANGE}0D` : "transparent"}
                >
                  <span style={{ ...mono, fontSize: 11, color: P.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.title || <span style={{ color: YELLOW }}>#{String(t.id)} (unresolved)</span>}
                  </span>
                  <span style={{ ...mono, fontSize: 11, color: P.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.artistName || "—"}
                  </span>
                  <span style={{ ...mono, fontSize: 10, color: t.genreNormalized ? P.textDim : YELLOW }}>
                    {t.genreNormalized || "(none)"}
                  </span>
                  <span style={{ ...mono, fontSize: 10, color: !t.access ? P.textDim : t.access === "playable" ? GREEN : RED }}>
                    {t.access || "unknown"}
                  </span>
                  <span style={{ ...mono, fontSize: 11, color: ORANGE, fontWeight: 600 }}>{t.touches}</span>
                  <span style={{ ...mono, fontSize: 11, color: P.textMid }}>{t.users}</span>
                  <span style={{ ...mono, fontSize: 10, color: P.textDim }}>
                    {t.last_touched ? timeAgo(t.last_touched) : "—"}
                  </span>
                  <span style={{ ...mono, fontSize: 10, color: t.resolveStatus === "resolved" ? P.textDim : YELLOW }}>
                    {t.resolveStatus}
                  </span>
                </div>
                {expandedTrack === t.id && (
                  <div style={{ padding: "6px 8px 12px 24px", borderBottom: `1px solid ${P.cardBorder}33` }}>
                    <div style={{ ...mono, fontSize: 9, color: P.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>
                      Operations touching this track (latest 50)
                    </div>
                    {!trackOps[t.id] ? (
                      <SkeletonBlock height={24} palette={P} />
                    ) : trackOps[t.id].length === 0 ? (
                      <div style={{ ...mono, fontSize: 11, color: P.textDim }}>No logged operations reference this track.</div>
                    ) : (
                      trackOps[t.id].map(op => (
                        <div key={op.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "3px 0" }}>
                          <span style={{ ...mono, fontSize: 11, color: ORANGE }}>@{op.user.username}</span>
                          <span style={{ ...mono, fontSize: 11, color: P.textMid }}>{op.actionName}</span>
                          <StatusPill status={op.status} />
                          <span style={{ ...mono, fontSize: 10, color: P.textDim }}>{timeAgo(op.createdAt)}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
            {/* Pagination */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <span style={{ ...mono, fontSize: 10, color: P.textDim }}>
                {total.toLocaleString()} tracks · page {page} of {totalPages}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setPage(p => Math.max(p - 1, 1))}
                  disabled={page <= 1}
                  style={{ ...catalogSelectStyle(P), cursor: page <= 1 ? "default" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}
                >
                  ← Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages}
                  style={{ ...catalogSelectStyle(P), cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.4 : 1 }}
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// --- Main Dashboard Component ---
export default function AdminDashboard() {
  const router = useRouter();
  const [period, setPeriod] = useState("30d");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOp, setSelectedOp] = useState(null);

  const [theme, setTheme] = useState("dark");
  const [time, setTime] = useState(new Date());

  const [stats, setStats] = useState(null);
  const [daily, setDaily] = useState([]);
  const [operations, setOperations] = useState([]);
  const [feedbackSummary, setFeedbackSummary] = useState(null);
  const [feedbackResponses, setFeedbackResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ADMIN_THEME_KEY);
      if (stored === "light" || stored === "dark") setTheme(stored);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Admin guard — redirect if not admin
  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (!data.isAdmin) router.replace("/dashboard");
      })
      .catch(() => router.replace("/dashboard"));
  }, [router]);

  // Fetch admin endpoints
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const opsUrl = `${API_BASE}/api/admin/operations?period=${period}&limit=50${
        statusFilter !== 'all' ? `&status=${statusFilter}` : ''
      }${searchQuery.trim() ? `&search=${encodeURIComponent(searchQuery.trim())}` : ''}`;

      const [statsRes, dailyRes, opsRes, fbSummaryRes, fbListRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/stats?period=${period}`, { credentials: "include" }),
        fetch(`${API_BASE}/api/admin/daily?period=${period}`, { credentials: "include" }),
        fetch(opsUrl, { credentials: "include" }),
        fetch(`${API_BASE}/api/admin/feedback/summary?period=${period}`, { credentials: "include" }),
        fetch(`${API_BASE}/api/admin/feedback?period=${period}&limit=50`, { credentials: "include" }),
      ]);
      if (!statsRes.ok || !dailyRes.ok || !opsRes.ok) {
        throw new Error(`API error: ${[statsRes, dailyRes, opsRes].find(r => !r.ok)?.status}`);
      }
      const [s, d, o] = await Promise.all([statsRes.json(), dailyRes.json(), opsRes.json()]);
      setStats(s);
      setDaily(d.daily || []);
      setOperations(o.operations || []);

      if (fbSummaryRes.ok) {
        const fb = await fbSummaryRes.json();
        setFeedbackSummary(fb);
      }
      if (fbListRes.ok) {
        const fb = await fbListRes.json();
        setFeedbackResponses(fb.responses || []);
      }

      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message || "Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, [period, statusFilter, searchQuery]);

  // Fetch on mount and period / filter change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(t);
  }, [fetchData]);

  // Derived sparkline from daily data
  const trackSparkline = daily.map(d => d.tracks);
  const opsSparkline = daily.map(d => d.operations);

  const P = PALETTES[theme];

  return (
    <div style={{ minHeight: "100vh", background: P.bg, color: P.text, fontFamily: "'Outfit', sans-serif", padding: 0, margin: 0 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.25; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${P.bg}; }
        ::-webkit-scrollbar-thumb { background: ${P.cardBorder}; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: "20px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${P.cardBorder}`,
          animation: "fadeSlideUp 0.4s 0s both cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "end", gap: 2, height: 24 }}>
            {[10, 18, 14, 22, 16, 20, 12, 24, 14, 18].map((h, i) => (
              <div key={i} style={{ width: 3, height: h, background: ORANGE, borderRadius: 1.5, opacity: 0.6 + (i % 3) * 0.15 }} />
            ))}
          </div>
          <div>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>SoundCloud Toolkit</span>
            <span
              style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                color: ORANGE,
                background: P.orangeDim,
                padding: "2px 8px",
                borderRadius: 4,
                marginLeft: 10,
                fontWeight: 600,
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              Admin Analytics
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <button
            type="button"
            onClick={() => setTheme(prev => (prev === "dark" ? "light" : "dark"))}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              color: P.textDim,
              background: P.segmentBg,
              border: `1px solid ${P.cardBorder}`,
              padding: "6px 12px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          {/* Period selector */}
          <div style={{ display: "flex", gap: 2, background: P.segmentBg, borderRadius: 6, padding: 2 }}>
            {["1d", "7d", "30d", "90d", "month", "all"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: period === p ? P.text : P.textDim,
                  background: period === p ? P.card : "transparent",
                  border: "none",
                  padding: "5px 12px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: period === p ? 600 : 400,
                  transition: "all 0.2s",
                }}
              >
                {p === "all" ? "All" : p}
              </button>
            ))}
          </div>
          {/* Live indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: loading ? YELLOW : GREEN, animation: "pulse-dot 2s ease infinite" }} />
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: P.textDim }}>
              {time.toLocaleTimeString("en-US", { hour12: false })}
            </span>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            background: `${RED}18`,
            borderBottom: `1px solid ${RED}40`,
            padding: "12px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 12, color: RED, fontFamily: "'JetBrains Mono', monospace" }}>⚠ {error}</span>
          <button
            onClick={fetchData}
            style={{
              fontSize: 11,
              fontFamily: "'JetBrains Mono', monospace",
              color: RED,
              background: `${RED}20`,
              border: `1px solid ${RED}40`,
              padding: "4px 12px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      <div style={{ padding: "24px 32px", maxWidth: 1320, margin: "0 auto" }}>

        {/* Top Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20 }}>
          <StatCard
            label="Registered Users"
            value={loading ? "—" : (stats?.totalUsers ?? 0).toLocaleString()}
            sub="All time"
            delay={0.05}
            palette={P}
          />
          <StatCard
            label="Tracks Processed"
            value={loading ? "—" : (stats?.tracksProcessed ?? 0).toLocaleString()}
            sub={periodSub(period)}
            spark={trackSparkline}
            sparkColor={ORANGE}
            delay={0.1}
            palette={P}
          />
          <StatCard
            label="New Users"
            value={loading ? "—" : (stats?.newUsers ?? 0).toLocaleString()}
            sub={periodSub(period)}
            spark={daily.map(d => d.newUsers)}
            sparkColor={GREEN}
            delay={0.15}
            palette={P}
          />
          <StatCard
            label="Active Users"
            value={loading ? "—" : (stats?.activeUsersPeriod ?? 0).toLocaleString()}
            sub={periodSub(period, "active")}
            trend="By operation logs"
            trendDir="flat"
            delay={0.175}
            palette={P}
          />
          <StatCard
            label="Total Operations"
            value={loading ? "—" : (stats?.operationsCount ?? 0).toLocaleString()}
            sub={periodSub(period)}
            spark={opsSparkline}
            sparkColor={YELLOW}
            delay={0.2}
            palette={P}
          />
        </div>

        {/* Main Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
          <SectionCard title={`Tracks Processed — ${periodTitleLabel(period)} Trend`} delay={0.25} palette={P}>
            {loading ? <SkeletonBlock height={200} palette={P} /> : <AreaChart data={daily} dataKey="tracks" color={ORANGE} width={700} height={200} palette={P} />}
          </SectionCard>

          <SectionCard title="Operation Health" delay={0.3} palette={P}>
            {loading ? (
              <SkeletonBlock height={200} palette={P} />
            ) : (
              <>
                <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", flex: 1, paddingTop: 8 }}>
                  <Donut value={stats?.successRate ?? 0} max={100} color={GREEN} label="Success Rate" size={100} palette={P} />
                  <Donut value={stats?.splitRate ?? 0} max={100} color={YELLOW} label="Split Rate" size={100} palette={P} />
                  <Donut value={stats?.errorRate ?? 0} max={100} color={RED} label="Error Rate" size={100} palette={P} />
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-around",
                    marginTop: 18,
                    padding: "12px 0 0",
                    borderTop: `1px solid ${P.cardBorder}`,
                  }}
                >
                  {[
                    { label: "Operations", value: (stats?.operationsCount ?? 0).toLocaleString(), color: P.text },
                    { label: "Tracks/Op Avg", value: (stats?.avgTracksPerOp ?? 0).toLocaleString(), color: CYAN },
                    { label: "Auto-Splits", value: (stats?.splitsCount ?? 0).toLocaleString(), color: YELLOW },
                    { label: "Partial", value: (stats?.partialCount ?? 0).toLocaleString(), color: ORANGE },
                  ].map((m) => (
                    <div key={m.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: "'Outfit', sans-serif" }}>{m.value}</div>
                      <div style={{ fontSize: 9, color: P.textDim, fontFamily: "'JetBrains Mono', monospace", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.6 }}>
                        {m.label}
                      </div>
                    </div>
                  ))}
                </div>
                {(stats?.analyticsWriteHealth?.failures ?? 0) > 0 && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: `${RED}14`,
                      color: RED,
                      fontSize: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    ⚠ {stats.analyticsWriteHealth.failures} operation-log write failure{stats.analyticsWriteHealth.failures === 1 ? "" : "s"} since server start — analytics rows are being dropped.
                    {stats.analyticsWriteHealth.lastFailureMessage ? ` Last: ${stats.analyticsWriteHealth.lastFailureMessage}` : ""}
                  </div>
                )}
              </>
            )}
          </SectionCard>
        </div>

        {/* Feature reach + completed operations */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <SectionCard title={`Feature Reach — ${periodTitleLabel(period)} Period`} delay={0.35} palette={P}>
            {loading ? <SkeletonBlock height={160} palette={P} /> : <HBar items={(stats?.featureReach ?? []).map((feature) => ({ ...feature, count: feature.users, color: CYAN }))} palette={P} />}
            {!loading && (
              <div style={{ fontSize: 10, color: P.textDim, fontFamily: "'JetBrains Mono', monospace", marginTop: 10 }}>
                Distinct signed-in users who opened each feature. No SoundCloud content is logged.
              </div>
            )}
          </SectionCard>

          <SectionCard title={`Completed Operations — ${periodTitleLabel(period)} Trend`} delay={0.4} palette={P}>
            {loading ? <SkeletonBlock height={200} palette={P} /> : <AreaChart data={daily} dataKey="operations" color={CYAN} width={500} height={200} palette={P} />}
          </SectionCard>
        </div>

        {/* Recent Ops with Search & Filters + Sidebar */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 16 }}>
          <SectionCard
            title="Operation Logs & Inspector"
            delay={0.45}
            palette={P}
            action={
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Search input */}
                <input
                  type="text"
                  placeholder="Filter by user or error..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    background: P.bg,
                    border: `1px solid ${P.cardBorder}`,
                    color: P.text,
                    fontSize: 11,
                    fontFamily: "'JetBrains Mono', monospace",
                    padding: "4px 8px",
                    borderRadius: 6,
                    outline: "none",
                    width: 180,
                  }}
                />
                {/* Status filter */}
                <div style={{ display: "flex", gap: 2, background: P.segmentBg, borderRadius: 6, padding: 2 }}>
                  {["all", "success", "split", "error", "partial"].map(s => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      style={{
                        fontSize: 10,
                        fontFamily: "'JetBrains Mono', monospace",
                        color: statusFilter === s ? P.text : P.textDim,
                        background: statusFilter === s ? P.card : "transparent",
                        border: "none",
                        padding: "3px 8px",
                        borderRadius: 4,
                        cursor: "pointer",
                        textTransform: "uppercase",
                        fontWeight: statusFilter === s ? 600 : 400,
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Array.from({ length: 6 }).map((_, i) => <SkeletonBlock key={i} height={36} palette={P} />)}
              </div>
            ) : operations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: P.textDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                No operations match your current filters.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 1.5fr 0.6fr 0.7fr 0.6fr 0.5fr",
                    gap: 8,
                    padding: "0 0 8px",
                    borderBottom: `1px solid ${P.cardBorder}`,
                    marginBottom: 4,
                  }}
                >
                  {["User", "Action", "Items", "Latency", "Time", "Status"].map((h) => (
                    <span key={h} style={{ fontSize: 9, color: P.textDim, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 0.8 }}>
                      {h}
                    </span>
                  ))}
                </div>
                {operations.map((op, i) => (
                  <div
                    key={op.id}
                    onClick={() => setSelectedOp(op)}
                    title="Click to view detailed metadata JSON"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1.5fr 0.6fr 0.7fr 0.6fr 0.5fr",
                      gap: 8,
                      padding: "9px 8px",
                      borderRadius: 6,
                      borderBottom: i < operations.length - 1 ? `1px solid ${P.cardBorder}33` : "none",
                      alignItems: "center",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = `${ORANGE}0D`}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <span style={{ fontSize: 12, color: ORANGE, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                      @{op.user.username}
                    </span>
                    <span style={{ fontSize: 12, color: P.textMid, fontFamily: "'JetBrains Mono', monospace" }}>{op.actionName}</span>
                    <span style={{ fontSize: 12, color: P.text, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                      {(op.trackCount || op.itemCount || 0).toLocaleString()}
                    </span>
                    <span style={{ fontSize: 11, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
                      {op.durationMs ? `${op.durationMs}ms` : "—"}
                    </span>
                    <span style={{ fontSize: 11, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{timeAgo(op.createdAt)}</span>
                    <StatusPill status={op.status} />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Sidebar Stats & Error Diagnostics */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SectionCard title="Top Feature" delay={0.475} palette={P}>
              {loading ? (
                <SkeletonBlock height={60} palette={P} />
              ) : stats?.topFeature ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 600, color: P.text, fontFamily: "'JetBrains Mono', monospace" }}>
                    {stats.topFeature.name}
                  </div>
                  <div style={{ fontSize: 11, color: P.textDim, fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>
                    {stats.topFeature.count.toLocaleString()} operations
                  </div>
                  <div style={{ marginTop: 10, height: 4, background: P.cardBorder, borderRadius: 2, overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.round((stats.topFeature.count / Math.max(stats.operationsCount, 1)) * 100)}%`,
                        background: ORANGE,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>No data yet</div>
              )}
            </SectionCard>

            <SectionCard title="Average Latency" delay={0.49} palette={P}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: CYAN }}>
                  {loading ? "—" : stats?.avgDurationMs ? `${stats.avgDurationMs}` : "—"}
                </span>
                <span style={{ fontSize: 11, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>ms/op</span>
              </div>
              <div style={{ fontSize: 11, color: P.textDim, fontFamily: "'JetBrains Mono', monospace", marginTop: 6 }}>
                {stats?.p95DurationMs ? `P95: ${stats.p95DurationMs}ms` : "Server execution time"}
              </div>
              {!loading && (stats?.featureUsage ?? []).some(f => f.avgDurationMs) && (
                <div style={{ marginTop: 10 }}>
                  <HBar items={(stats?.featureUsage ?? []).filter(f => f.avgDurationMs).map((feature) => ({ ...feature, count: feature.count, avgDurationMs: feature.avgDurationMs, color: CYAN }))} palette={P} />
                </div>
              )}
            </SectionCard>

            {stats?.errorBreakdown && stats.errorBreakdown.length > 0 && (
              <SectionCard title="Top Error Diagnostics" delay={0.5} palette={P}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {stats.errorBreakdown.map(err => (
                    <div key={err.errorCode} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: RED, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                        {err.errorCode}
                      </span>
                      <span style={{ fontSize: 11, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
                        {err.count} count
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {stats?.errorRateByAction && stats.errorRateByAction.length > 0 && (
              <SectionCard title="Error Rate by Action" delay={0.51} palette={P}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {stats.errorRateByAction.map(action => (
                    <div key={action.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: P.textMid, fontFamily: "'JetBrains Mono', monospace" }}>
                        {action.name}
                      </span>
                      <span style={{ fontSize: 11, color: action.errorRate >= 20 ? RED : P.textDim, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                        {action.errorRate}% ({action.errorCount}/{action.count})
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            <SectionCard title="Playlist Splits" delay={0.55} palette={P}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: YELLOW }}>
                  {loading ? "—" : (stats?.splitsCount ?? 0).toLocaleString()}
                </span>
                <span style={{ fontSize: 11, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>auto-splits</span>
              </div>
              <div style={{ fontSize: 11, color: P.textDim, fontFamily: "'JetBrains Mono', monospace", marginTop: 6 }}>
                Triggered when merges exceed 500 tracks
              </div>
            </SectionCard>

            <SectionCard title="Avg Tracks / Operation" delay={0.6} palette={P}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: CYAN }}>
                  {loading ? "—" : (stats?.avgTracksPerOp ?? 0).toLocaleString()}
                </span>
                <span style={{ fontSize: 11, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>tracks</span>
              </div>
              {trackSparkline.length >= 2 && (
                <SparklineChart data={trackSparkline} color={CYAN} width={180} height={32} filled />
              )}
            </SectionCard>
          </div>
        </div>

        {/* Music Catalog */}
        <MusicCatalogSection period={period} palette={P} />

        {/* SongSwipe Beta Survey */}
        <div style={{ marginTop: 20 }}>
          <SectionCard
            title={`SongSwipe Beta Survey — ${periodTitleLabel(period)} Period`}
            delay={0.55}
            palette={P}
            action={
              <a
                href={`${API_BASE}/api/admin/feedback/beta-emails`}
                style={{
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: ORANGE,
                  textDecoration: "none",
                  border: `1px solid ${ORANGE}55`,
                  borderRadius: 6,
                  padding: "5px 10px",
                }}
              >
                ↓ Export beta emails ({feedbackSummary?.wantsBetaCount ?? 0})
              </a>
            }
          >
            {loading ? (
              <SkeletonBlock height={200} palette={P} />
            ) : !feedbackSummary || feedbackSummary.total === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: P.textDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                No survey responses yet in this period.
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 14 }}>
                  <FeedbackBreakdown
                    title="Interest"
                    palette={P}
                    counts={feedbackSummary.interest || {}}
                    total={feedbackSummary.total}
                    order={["very", "somewhat", "not"]}
                    labels={{ very: "Very interested", somewhat: "Somewhat", not: "Not for me" }}
                    colors={{ very: GREEN, somewhat: YELLOW, not: RED }}
                  />
                  <FeedbackBreakdown
                    title="Rekordbox use"
                    palette={P}
                    counts={feedbackSummary.rekordboxUse || {}}
                    total={feedbackSummary.total}
                    order={["rekordbox_primary", "rekordbox_sometimes", "other_software", "no"]}
                    labels={{
                      rekordbox_primary: "Primary",
                      rekordbox_sometimes: "Sometimes",
                      other_software: "Other software",
                      no: "No",
                    }}
                    colors={{ rekordbox_primary: ORANGE, rekordbox_sometimes: YELLOW, other_software: CYAN, no: RED }}
                  />
                  <FeedbackBreakdown
                    title="Platform"
                    palette={P}
                    counts={feedbackSummary.platform || {}}
                    total={feedbackSummary.total}
                    order={["mac", "windows", "both", "unanswered"]}
                    labels={{ mac: "macOS", windows: "Windows", both: "Both", unanswered: "—" }}
                    colors={{ mac: CYAN, windows: ORANGE, both: GREEN, unanswered: P.textDim }}
                  />
                </div>

                <div style={{ borderTop: `1px solid ${P.cardBorder}`, paddingTop: 12 }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1.4fr 0.7fr 0.6fr 0.5fr 2fr 0.7fr",
                    gap: 8,
                    padding: "0 0 8px",
                    borderBottom: `1px solid ${P.cardBorder}`,
                    marginBottom: 4,
                  }}>
                    {["User", "Email", "Interest", "Beta", "Plat", "Ideas / name", "When"].map(h => (
                      <span key={h} style={{ fontSize: 9, color: P.textDim, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</span>
                    ))}
                  </div>
                  {feedbackResponses.length === 0 ? (
                    <div style={{ padding: "16px 0", color: P.textDim, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, textAlign: "center" }}>
                      Aggregates only — no detail rows in this window.
                    </div>
                  ) : (
                    feedbackResponses.map((r, i) => {
                      const ideas = [r.suggestions, r.nameIdea ? `name: ${r.nameIdea}` : null].filter(Boolean).join(" · ");
                      return (
                        <div
                          key={r.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1.4fr 0.7fr 0.6fr 0.5fr 2fr 0.7fr",
                            gap: 8,
                            padding: "9px 0",
                            borderBottom: i < feedbackResponses.length - 1 ? `1px solid ${P.cardBorder}33` : "none",
                            alignItems: "center",
                            fontSize: 11,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          <span style={{ color: ORANGE, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{r.user.username}</span>
                          <span style={{ color: P.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.email || ""}>
                            {r.email || <span style={{ color: P.textDim }}>—</span>}
                          </span>
                          <span style={{ color: P.text, fontWeight: 600 }}>{r.interest}</span>
                          <span style={{ color: r.wantsBeta ? GREEN : P.textDim }}>{r.wantsBeta ? "✓" : "—"}</span>
                          <span style={{ color: P.textDim }}>{r.platform || "—"}</span>
                          <span style={{ color: P.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ideas}>
                            {ideas || <span style={{ color: P.textDim }}>—</span>}
                          </span>
                          <span style={{ color: P.textDim }}>{timeAgo(r.createdAt)}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </SectionCard>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 28,
            padding: "16px 0",
            borderTop: `1px solid ${P.cardBorder}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            animation: "fadeSlideUp 0.6s 0.7s both cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "end", gap: 1.5, height: 12 }}>
              {[5, 9, 7, 11, 8].map((h, i) => (
                <div key={i} style={{ width: 2, height: h, background: ORANGE, borderRadius: 1, opacity: 0.5 }} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>SoundCloud Toolkit Admin</span>
          </div>
          <span style={{ fontSize: 10, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
            Last refreshed: {lastRefresh.toLocaleTimeString("en-US", { hour12: true })} · Auto-refreshes every 30s
          </span>
        </div>
      </div>

      {/* Operation Details Modal */}
      {selectedOp && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
          onClick={() => setSelectedOp(null)}
        >
          <div
            style={{
              background: P.card,
              border: `1px solid ${P.cardBorder}`,
              borderRadius: 12,
              maxWidth: 640,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: 24,
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: P.textDim, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 1.2 }}>
                  Operation Inspector
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: P.text, marginTop: 4 }}>
                  {selectedOp.actionName} <span style={{ fontSize: 13, color: P.textDim, fontWeight: 400 }}>({selectedOp.action})</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedOp(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: P.textDim,
                  fontSize: 20,
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16, background: P.segmentBg, padding: 12, borderRadius: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>USER</div>
                <div style={{ fontSize: 13, color: ORANGE, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>@{selectedOp.user.username}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>SOUNDCLOUD ID</div>
                <div style={{ fontSize: 13, color: YELLOW, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                  {selectedOp.soundcloudId || selectedOp.user?.soundcloudId ? `SC: ${selectedOp.soundcloudId || selectedOp.user?.soundcloudId}` : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>STATUS</div>
                <div style={{ marginTop: 2 }}><StatusPill status={selectedOp.status} /></div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>DURATION</div>
                <div style={{ fontSize: 13, color: CYAN, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                  {selectedOp.durationMs ? `${selectedOp.durationMs} ms` : "—"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>TIME</div>
                <div style={{ fontSize: 12, color: P.textMid, fontFamily: "'JetBrains Mono', monospace" }}>
                  {new Date(selectedOp.createdAt).toLocaleString()}
                </div>
              </div>
              {selectedOp.clientInfo && (
                <div>
                  <div style={{ fontSize: 10, color: P.textDim, fontFamily: "'JetBrains Mono', monospace" }}>CLIENT ENVIRONMENT</div>
                  <div style={{ fontSize: 12, color: P.textMid, fontFamily: "'JetBrains Mono', monospace" }}>
                    {selectedOp.clientInfo.device} · {selectedOp.clientInfo.browser} · {selectedOp.clientInfo.platform}
                  </div>
                </div>
              )}
            </div>

            {/* Explicit Resource Summaries */}
            {selectedOp.metadata?.trackIds && Array.isArray(selectedOp.metadata.trackIds) && (
              <div style={{ background: `${CYAN}10`, border: `1px solid ${CYAN}33`, padding: 12, borderRadius: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: CYAN, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
                  OPERATED TRACK IDS ({selectedOp.metadata.trackIds.length} tracks)
                </div>
                <div style={{ fontSize: 11, color: P.text, fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all" }}>
                  {selectedOp.metadata.trackIds.join(", ")}
                </div>
              </div>
            )}

            {selectedOp.metadata?.playlistIds && Array.isArray(selectedOp.metadata.playlistIds) && (
              <div style={{ background: `${ORANGE}10`, border: `1px solid ${ORANGE}33`, padding: 12, borderRadius: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: ORANGE, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
                  AFFECTED PLAYLIST IDS ({selectedOp.metadata.playlistIds.length} playlists)
                </div>
                <div style={{ fontSize: 11, color: P.text, fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all" }}>
                  {selectedOp.metadata.playlistIds.join(", ")}
                </div>
              </div>
            )}

            {selectedOp.metadata?.targetUserIds && Array.isArray(selectedOp.metadata.targetUserIds) && (
              <div style={{ background: `${YELLOW}10`, border: `1px solid ${YELLOW}33`, padding: 12, borderRadius: 8, marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: YELLOW, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>
                  TARGET USER IDS ({selectedOp.metadata.targetUserIds.length} users)
                </div>
                <div style={{ fontSize: 11, color: P.text, fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all" }}>
                  {selectedOp.metadata.targetUserIds.join(", ")}
                </div>
              </div>
            )}

            {(selectedOp.errorCode || selectedOp.errorMessage) && (
              <div style={{ background: `${RED}15`, border: `1px solid ${RED}33`, padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: RED, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                  ERROR DIAGNOSTIC: {selectedOp.errorCode || "ERROR"}
                </div>
                <div style={{ fontSize: 12, color: P.text, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
                  {selectedOp.errorMessage || "No message provided"}
                </div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 10, color: P.textDim, fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
                METADATA JSON
              </div>
              <pre
                style={{
                  background: P.bg,
                  border: `1px solid ${P.cardBorder}`,
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 11,
                  color: GREEN,
                  fontFamily: "'JetBrains Mono', monospace",
                  overflowX: "auto",
                  maxHeight: 240,
                }}
              >
                {JSON.stringify(selectedOp.metadata || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
