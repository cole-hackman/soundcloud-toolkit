import { useState, useEffect, useRef } from "react";

const ORANGE = "#FF5500";
const ORANGE_DIM = "rgba(255,85,0,0.15)";
const ORANGE_MED = "rgba(255,85,0,0.4)";
const BG = "#0D0D0F";
const CARD = "#141417";
const CARD_BORDER = "#1E1E23";
const TEXT = "#E8E6E1";
const TEXT_DIM = "#6B6A67";
const TEXT_MID = "#9A9893";
const GREEN = "#2ECC71";
const RED = "#E74C3C";
const YELLOW = "#F1C40F";
const CYAN = "#00D4AA";

// --- Mock Data Generation ---
function generateSparkline(points = 28, min = 20, max = 100) {
  const data = [];
  let val = min + Math.random() * (max - min) * 0.5;
  for (let i = 0; i < points; i++) {
    val += (Math.random() - 0.45) * (max - min) * 0.15;
    val = Math.max(min, Math.min(max, val));
    data.push(Math.round(val));
  }
  return data;
}

function generateDailyData(days = 28) {
  const data = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    data.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      tracks: Math.floor(Math.random() * 800 + 200),
      sessions: Math.floor(Math.random() * 120 + 30),
      apiCalls: Math.floor(Math.random() * 5000 + 1000),
    });
  }
  return data;
}

const FEATURES = [
  { name: "Playlist Merge", key: "merge", count: 1847, color: ORANGE },
  { name: "Bulk Unlike", key: "unlike", count: 1523, color: CYAN },
  { name: "Likes → Playlist", key: "likes2pl", count: 1211, color: GREEN },
  { name: "URL Resolve", key: "resolve", count: 3892, color: YELLOW },
  { name: "Bulk Unfollow", key: "unfollow", count: 687, color: "#E066FF" },
  { name: "Proxy Download", key: "download", count: 2104, color: "#4DA6FF" },
];

const RECENT_OPS = [
  { user: "djmike99", action: "Merged 3 playlists", tracks: 847, time: "2m ago", status: "success" },
  { user: "basshead_x", action: "Bulk unliked tracks", tracks: 312, time: "5m ago", status: "success" },
  { user: "melodicvibes", action: "Likes → Playlist", tracks: 500, time: "8m ago", status: "split" },
  { user: "synth_lord", action: "Resolved batch URLs", tracks: 24, time: "12m ago", status: "success" },
  { user: "djmike99", action: "Bulk unfollowed", tracks: 45, time: "18m ago", status: "success" },
  { user: "cloudchaser", action: "Merged 2 playlists", tracks: 623, time: "22m ago", status: "split" },
  { user: "lofi_sarah", action: "Proxy download", tracks: 1, time: "25m ago", status: "success" },
  { user: "trapking200", action: "Bulk unliked tracks", tracks: 1048, time: "31m ago", status: "success" },
];

const DAILY = generateDailyData(28);

// --- SVG Chart Components ---
function SparklineChart({ data, color = ORANGE, width = 200, height = 48, filled = false }) {
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

function AreaChart({ data, dataKey, color = ORANGE, width = 600, height = 180 }) {
  const values = data.map((d) => d[dataKey]);
  const max = Math.max(...values) * 1.1;
  const padL = 50, padR = 16, padT = 12, padB = 28;
  const cw = width - padL - padR;
  const ch = height - padT - padB;

  const pts = values.map((v, i) => ({
    x: padL + (i / (values.length - 1)) * cw,
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
            <line x1={padL} y1={y} x2={width - padR} y2={y} stroke={CARD_BORDER} strokeWidth="1" />
            <text x={padL - 8} y={y + 4} textAnchor="end" fill={TEXT_DIM} fontSize="10" fontFamily="'JetBrains Mono', monospace">
              {gv >= 1000 ? `${(gv / 1000).toFixed(1)}k` : gv}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        if (i % 7 !== 0 && i !== data.length - 1) return null;
        const x = padL + (i / (data.length - 1)) * cw;
        return (
          <text key={i} x={x} y={height - 4} textAnchor="middle" fill={TEXT_DIM} fontSize="9" fontFamily="'JetBrains Mono', monospace">
            {d.date}
          </text>
        );
      })}
      <path d={areaD} fill={`url(#area-${dataKey})`} />
      <path d={lineD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {pts.slice(-1).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={BG} stroke={color} strokeWidth="2" />
      ))}
    </svg>
  );
}

function HBar({ items, maxVal }) {
  const m = maxVal || Math.max(...items.map((i) => i.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((item) => (
        <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 110, fontSize: 12, color: TEXT_MID, fontFamily: "'JetBrains Mono', monospace", textAlign: "right", flexShrink: 0 }}>
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
          <span style={{ width: 52, fontSize: 13, color: TEXT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, textAlign: "right", flexShrink: 0 }}>
            {item.count.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

// --- Stat Card ---
function StatCard({ label, value, sub, trend, trendDir, spark, sparkColor, delay = 0 }) {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${CARD_BORDER}`,
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
          <div style={{ fontSize: 11, color: TEXT_DIM, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 1.2 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: TEXT, fontFamily: "'Outfit', sans-serif", marginTop: 4, lineHeight: 1 }}>{value}</div>
        </div>
        {spark && (
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
              color: trendDir === "up" ? GREEN : trendDir === "down" ? RED : TEXT_DIM,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            {trendDir === "up" ? "▲" : trendDir === "down" ? "▼" : "—"} {trend}
          </span>
        )}
        {sub && <span style={{ fontSize: 11, color: TEXT_DIM, fontFamily: "'JetBrains Mono', monospace" }}>{sub}</span>}
      </div>
    </div>
  );
}

// --- Section Card ---
function SectionCard({ title, children, span = 1, delay = 0, style: s }) {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${CARD_BORDER}`,
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
          color: TEXT_DIM,
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
        {title}
      </div>
      {children}
    </div>
  );
}

// --- Status Pill ---
function StatusPill({ status }) {
  const config = {
    success: { bg: `${GREEN}18`, color: GREEN, label: "OK" },
    split: { bg: `${YELLOW}18`, color: YELLOW, label: "SPLIT" },
    error: { bg: `${RED}18`, color: RED, label: "ERR" },
  };
  const c = config[status] || config.success;
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

// --- Donut ---
function Donut({ value, max, color = ORANGE, label, size = 96 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const pct = value / max;
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} style={{ display: "block", margin: "0 auto" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={CARD_BORDER} strokeWidth="6" />
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
        <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="central" fill={TEXT} fontSize="18" fontWeight="700" fontFamily="'Outfit', sans-serif">
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <div style={{ fontSize: 10, color: TEXT_DIM, fontFamily: "'JetBrains Mono', monospace", marginTop: 6 }}>{label}</div>
    </div>
  );
}

// --- Main Dashboard ---
export default function Dashboard() {
  const [time, setTime] = useState(new Date());
  const [period, setPeriod] = useState("28d");

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const totalTracks = DAILY.reduce((s, d) => s + d.tracks, 0);
  const totalSessions = DAILY.reduce((s, d) => s + d.sessions, 0);
  const totalAPI = DAILY.reduce((s, d) => s + d.apiCalls, 0);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT,
        fontFamily: "'Outfit', sans-serif",
        padding: 0,
        margin: 0,
      }}
    >
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
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: ${BG}; }
        ::-webkit-scrollbar-thumb { background: ${CARD_BORDER}; border-radius: 3px; }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: "20px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${CARD_BORDER}`,
          animation: "fadeSlideUp 0.4s 0s both cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* SC-style waveform icon */}
          <div style={{ display: "flex", alignItems: "end", gap: 2, height: 24 }}>
            {[10, 18, 14, 22, 16, 20, 12, 24, 14, 18].map((h, i) => (
              <div
                key={i}
                style={{
                  width: 3,
                  height: h,
                  background: ORANGE,
                  borderRadius: 1.5,
                  opacity: 0.6 + (i % 3) * 0.15,
                }}
              />
            ))}
          </div>
          <div>
            <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.5 }}>SoundCloud Toolkit</span>
            <span
              style={{
                fontSize: 10,
                fontFamily: "'JetBrains Mono', monospace",
                color: ORANGE,
                background: ORANGE_DIM,
                padding: "2px 8px",
                borderRadius: 4,
                marginLeft: 10,
                fontWeight: 600,
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              Admin
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* Period selector */}
          <div style={{ display: "flex", gap: 2, background: `${CARD_BORDER}`, borderRadius: 6, padding: 2 }}>
            {["7d", "28d", "90d"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                style={{
                  fontSize: 11,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: period === p ? TEXT : TEXT_DIM,
                  background: period === p ? CARD : "transparent",
                  border: "none",
                  padding: "5px 12px",
                  borderRadius: 4,
                  cursor: "pointer",
                  fontWeight: period === p ? 600 : 400,
                  transition: "all 0.2s",
                }}
              >
                {p}
              </button>
            ))}
          </div>
          {/* Live indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, animation: "pulse-dot 2s ease infinite" }} />
            <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: TEXT_DIM }}>
              {time.toLocaleTimeString("en-US", { hour12: false })}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "24px 32px", maxWidth: 1320, margin: "0 auto" }}>
        {/* Top Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
          <StatCard
            label="Total Users"
            value="2,847"
            trend="+12.4%"
            trendDir="up"
            sub="past 28 days"
            spark={generateSparkline(28, 60, 100)}
            sparkColor={CYAN}
            delay={0.05}
          />
          <StatCard
            label="Tracks Processed"
            value={totalTracks.toLocaleString()}
            trend="+8.2%"
            trendDir="up"
            sub="past 28 days"
            spark={DAILY.map((d) => d.tracks)}
            sparkColor={ORANGE}
            delay={0.1}
          />
          <StatCard
            label="Active Sessions"
            value="143"
            trend="+3.1%"
            trendDir="up"
            sub="right now"
            spark={generateSparkline(28, 80, 160)}
            sparkColor={GREEN}
            delay={0.15}
          />
          <StatCard
            label="API Calls (24h)"
            value={Math.round(totalAPI / 28).toLocaleString()}
            trend="-2.1%"
            trendDir="down"
            sub="avg daily"
            spark={DAILY.map((d) => d.apiCalls)}
            sparkColor={YELLOW}
            delay={0.2}
          />
        </div>

        {/* Main Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
          {/* Tracks Over Time */}
          <SectionCard title="Tracks Processed — 28 Day Trend" delay={0.25}>
            <AreaChart data={DAILY} dataKey="tracks" color={ORANGE} width={700} height={200} />
          </SectionCard>

          {/* Donuts */}
          <SectionCard title="Health Metrics" delay={0.3}>
            <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", flex: 1, paddingTop: 8 }}>
              <Donut value={97.2} max={100} color={GREEN} label="API Uptime" size={100} />
              <Donut value={82} max={100} color={ORANGE} label="Cache Hit" size={100} />
              <Donut value={23} max={100} color={CYAN} label="Rate Limited" size={100} />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-around",
                marginTop: 18,
                padding: "12px 0 0",
                borderTop: `1px solid ${CARD_BORDER}`,
              }}
            >
              {[
                { label: "Avg Response", value: "142ms", color: GREEN },
                { label: "P95 Latency", value: "380ms", color: YELLOW },
                { label: "Error Rate", value: "0.3%", color: GREEN },
              ].map((m) => (
                <div key={m.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: m.color, fontFamily: "'Outfit', sans-serif" }}>{m.value}</div>
                  <div style={{ fontSize: 9, color: TEXT_DIM, fontFamily: "'JetBrains Mono', monospace", marginTop: 2, textTransform: "uppercase", letterSpacing: 0.6 }}>
                    {m.label}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* Feature Usage + Sessions */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
          <SectionCard title="Feature Usage — Total Operations" delay={0.35}>
            <HBar items={FEATURES} />
          </SectionCard>

          <SectionCard title="Sessions — 28 Day Trend" delay={0.4}>
            <AreaChart data={DAILY} dataKey="sessions" color={CYAN} width={500} height={200} />
          </SectionCard>
        </div>

        {/* Bottom Row: Recent Ops + Quick Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 16 }}>
          {/* Recent Operations */}
          <SectionCard title="Recent Operations" delay={0.45}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Header */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.5fr 0.7fr 0.7fr 0.5fr",
                  gap: 8,
                  padding: "0 0 8px",
                  borderBottom: `1px solid ${CARD_BORDER}`,
                  marginBottom: 4,
                }}
              >
                {["User", "Action", "Tracks", "Time", "Status"].map((h) => (
                  <span key={h} style={{ fontSize: 9, color: TEXT_DIM, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: 0.8 }}>
                    {h}
                  </span>
                ))}
              </div>
              {/* Rows */}
              {RECENT_OPS.map((op, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1.5fr 0.7fr 0.7fr 0.5fr",
                    gap: 8,
                    padding: "9px 0",
                    borderBottom: i < RECENT_OPS.length - 1 ? `1px solid ${CARD_BORDER}22` : "none",
                    alignItems: "center",
                    animation: `fadeSlideUp 0.4s ${0.5 + i * 0.04}s both cubic-bezier(0.22,1,0.36,1)`,
                  }}
                >
                  <span style={{ fontSize: 12, color: ORANGE, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>@{op.user}</span>
                  <span style={{ fontSize: 12, color: TEXT_MID, fontFamily: "'JetBrains Mono', monospace" }}>{op.action}</span>
                  <span style={{ fontSize: 12, color: TEXT, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{op.tracks.toLocaleString()}</span>
                  <span style={{ fontSize: 11, color: TEXT_DIM, fontFamily: "'JetBrains Mono', monospace" }}>{op.time}</span>
                  <StatusPill status={op.status} />
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Sidebar Quick Stats */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <SectionCard title="Top Endpoint (24h)" delay={0.5}>
              <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, fontFamily: "'JetBrains Mono', monospace" }}>/api/resolve</div>
              <div style={{ fontSize: 11, color: TEXT_DIM, fontFamily: "'JetBrains Mono', monospace", marginTop: 4 }}>3,892 calls</div>
              <div style={{ marginTop: 10, height: 4, background: CARD_BORDER, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", width: "78%", background: ORANGE, borderRadius: 2 }} />
              </div>
            </SectionCard>

            <SectionCard title="Playlist Splits" delay={0.55}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: YELLOW }}>47</span>
                <span style={{ fontSize: 11, color: TEXT_DIM, fontFamily: "'JetBrains Mono', monospace" }}>auto-splits</span>
              </div>
              <div style={{ fontSize: 11, color: TEXT_DIM, fontFamily: "'JetBrains Mono', monospace", marginTop: 6 }}>
                Triggered when merges exceed 500 tracks
              </div>
            </SectionCard>

            <SectionCard title="Avg Tracks / Operation" delay={0.6}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: CYAN }}>186</span>
                <span style={{ fontSize: 11, color: TEXT_DIM, fontFamily: "'JetBrains Mono', monospace" }}>tracks</span>
              </div>
              <SparklineChart data={generateSparkline(20, 120, 260)} color={CYAN} width={180} height={32} filled />
            </SectionCard>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: 28,
            padding: "16px 0",
            borderTop: `1px solid ${CARD_BORDER}`,
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
            <span style={{ fontSize: 11, color: TEXT_DIM, fontFamily: "'JetBrains Mono', monospace" }}>SoundCloud Toolkit Admin</span>
          </div>
          <span style={{ fontSize: 10, color: TEXT_DIM, fontFamily: "'JetBrains Mono', monospace" }}>
            Last refreshed: {time.toLocaleTimeString("en-US", { hour12: true })}
          </span>
        </div>
      </div>
    </div>
  );
}
