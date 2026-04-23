import { useState, useEffect, useCallback, useRef } from "react";

const ML_URL = "http://ml-analyzer.local";
const PROM   = "http://prometheus.local/api/v1/query";

const C = {
  bg:          "#F8F7F4",
  surface:     "#FFFFFF",
  surfaceAlt:  "#F2F0ED",
  border:      "rgba(0,0,0,0.08)",
  borderMed:   "rgba(0,0,0,0.14)",
  ink:         "#0D0D0D",
  inkSub:      "#4A4A4A",
  inkMuted:    "#9A9A9A",
  accent:      "#1A1A2E",
  accentLight: "#EEEEF5",
  green:       "#1B7A4B",
  greenLight:  "#EBF7F1",
  greenBorder: "#A8DFC4",
  red:         "#C0392B",
  redLight:    "#FDECEA",
  redBorder:   "#F5B7B1",
  orange:      "#C0550A",
  orangeLight: "#FEF3EB",
  orangeBorder:"#F9C49A",
  blue:        "#1565C0",
  blueLight:   "#EBF2FC",
  blueBorder:  "#A8C8F5",
  shadow:      "0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)",
  shadowMd:    "0 4px 12px rgba(0,0,0,0.08), 0 16px 40px rgba(0,0,0,0.07)",
};

const MONO = "'IBM Plex Mono', 'Fira Code', monospace";
const SANS = "'Instrument Sans', 'DM Sans', system-ui, sans-serif";
const DISP = "'Syne', 'DM Sans', sans-serif";

async function fetchVMNames() {
  try {
    const res  = await fetch(`${PROM}?query=vmware_vm_power_state`);
    const json = await res.json();
    return (json?.data?.result || []).map(r => ({
      name:  r.metric.vm_name,
      state: r.value[1] === "1" ? "online" : "offline",
    }));
  } catch { return []; }
}

async function analyzeVM(vmName, windowMin) {
  const res = await fetch(
    `${ML_URL}/api/v1/analyze/${encodeURIComponent(vmName)}?window=${windowMin}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Sparkline SVG ────────────────────────────────────────────────────────────
function Sparkline({ values, color, height = 36, width = 120 }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

// ─── Gauge ────────────────────────────────────────────────────────────────────
function Gauge({ score, severity }) {
  const normalized = score !== null ? Math.max(0, Math.min(100, (score + 0.5) * 200)) : 50;
  const angle = -135 + (normalized / 100) * 270;
  const color = severity === "critical" ? C.red : severity === "warning" ? C.orange : C.green;
  const r = 44;
  const cx = 60, cy = 60;
  const toRad = d => (d * Math.PI) / 180;
  const arcX  = cx + r * Math.cos(toRad(angle - 90));
  const arcY  = cy + r * Math.sin(toRad(angle - 90));
  const startX = cx + r * Math.cos(toRad(-135 - 90));
  const startY = cy + r * Math.sin(toRad(-135 - 90));
  const largeArc = normalized > 50 ? 1 : 0;

  return (
    <svg width="120" height="90" viewBox="0 0 120 80" style={{ display: "block", margin: "0 auto" }}>
      <path
        d={`M ${cx + r * Math.cos(toRad(-135 - 90))} ${cy + r * Math.sin(toRad(-135 - 90))} A ${r} ${r} 0 1 1 ${cx + r * Math.cos(toRad(135 - 90))} ${cy + r * Math.sin(toRad(135 - 90))}`}
        fill="none" stroke={C.border} strokeWidth="6" strokeLinecap="round"
      />
      <path
        d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${arcX} ${arcY}`}
        fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
        style={{ transition: "all 0.8s ease" }}
      />
      <text x={cx} y={cy + 4} textAnchor="middle"
        style={{ fontSize: 13, fontWeight: 700, fontFamily: MONO, fill: color }}>
        {score !== null ? score.toFixed(3) : "—"}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle"
        style={{ fontSize: 8, fontFamily: MONO, fill: C.inkMuted }}>
        anomaly score
      </text>
    </svg>
  );
}

// ─── ZBar ─────────────────────────────────────────────────────────────────────
function ZBar({ feature, value, z }) {
  const pct   = Math.min(100, (z / 4) * 100);
  const color = z > 3 ? C.red : z > 2 ? C.orange : z > 1 ? "#B8860B" : C.green;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: C.inkSub, fontFamily: MONO }}>{feature}</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: C.inkMuted, fontFamily: MONO }}>
            {typeof value === "number" ? value.toFixed(2) : value}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
            background: z > 2 ? C.redLight : C.surfaceAlt,
            color, fontFamily: MONO, border: `1px solid ${z > 2 ? C.redBorder : C.border}`,
          }}>z {z.toFixed(1)}</span>
        </div>
      </div>
      <div style={{ height: 3, background: C.border, borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, background: color,
          borderRadius: 2, transition: "width 1s ease",
        }}/>
      </div>
    </div>
  );
}

// ─── MetricPill ───────────────────────────────────────────────────────────────
function MetricPill({ label, value, unit, color, light, border }) {
  return (
    <div style={{
      padding: "14px 18px", borderRadius: 10,
      background: light, border: `1px solid ${border}`,
      minWidth: 90, flex: "1 1 90px",
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: MONO, lineHeight: 1 }}>
        {value}<span style={{ fontSize: 11, fontWeight: 400, marginLeft: 2 }}>{unit}</span>
      </div>
      <div style={{ fontSize: 10, color, opacity: 0.7, fontFamily: MONO, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </div>
    </div>
  );
}

// ─── HistoryLine ──────────────────────────────────────────────────────────────
function HistoryLine({ entries }) {
  if (!entries.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {entries.slice().reverse().map((e, i) => {
        const color = e.severity === "critical" ? C.red : e.severity === "warning" ? C.orange : C.green;
        const light = e.severity === "critical" ? C.redLight : e.severity === "warning" ? C.orangeLight : C.greenLight;
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 14px", borderRadius: 8,
            background: i === 0 ? light : C.surface,
            border: `1px solid ${i === 0 ? color + "44" : C.border}`,
            animation: i === 0 ? "slideIn 0.3s ease" : "none",
          }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }}/>
            <span style={{ fontSize: 10, color: C.inkMuted, fontFamily: MONO, flexShrink: 0 }}>
              {new Date(e.timestamp).toLocaleTimeString("fr-FR")}
            </span>
            <span style={{ fontSize: 11, fontWeight: 600, color, fontFamily: MONO, flexShrink: 0 }}>
              {e.severity.toUpperCase()}
            </span>
            <span style={{ fontSize: 11, color: C.inkSub, fontFamily: MONO, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {e.reasons?.length ? e.reasons.join(" · ") : "Aucune anomalie détectée"}
            </span>
            <span style={{ fontSize: 10, color: C.inkMuted, fontFamily: MONO, flexShrink: 0 }}>
              {e.anomaly_score?.toFixed(3)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MLAnalyzerPage() {
  const [vms,        setVms]        = useState([]);
  const [selectedVm, setSelectedVm] = useState("");
  const [windowMin,  setWindowMin]  = useState(15);
  const [interval,   setIntervalS]  = useState(30);
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [running,    setRunning]    = useState(false);
  const [history,    setHistory]    = useState([]);
  const [tick,       setTick]       = useState(0);
  const [scoreHistory, setScoreHistory] = useState([]);
  const timerRef  = useRef(null);
  const tickRef   = useRef(null);

  useEffect(() => {
    fetchVMNames().then(list => {
      setVms(list);
      if (list.length) setSelectedVm(list[0].name);
    });
  }, []);

  const runAnalysis = useCallback(async () => {
    if (!selectedVm) return;
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeVM(selectedVm, windowMin);
      setResult(data);
      setHistory(h => [...h.slice(-49), data]);
      setScoreHistory(h => [...h.slice(-59), data.anomaly_score ?? 0]);
      setTick(interval);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedVm, windowMin, interval]);

  const startStop = useCallback(() => {
    if (running) {
      clearInterval(timerRef.current);
      clearInterval(tickRef.current);
      setRunning(false);
      setTick(0);
    } else {
      setRunning(true);
      runAnalysis();
      timerRef.current = setInterval(runAnalysis, interval * 1000);
      tickRef.current  = setInterval(() => setTick(t => Math.max(0, t - 1)), 1000);
    }
  }, [running, runAnalysis, interval]);

  useEffect(() => {
    return () => { clearInterval(timerRef.current); clearInterval(tickRef.current); };
  }, []);

  // Restart interval when settings change
  useEffect(() => {
    if (running) {
      clearInterval(timerRef.current);
      clearInterval(tickRef.current);
      timerRef.current = setInterval(runAnalysis, interval * 1000);
      tickRef.current  = setInterval(() => setTick(t => Math.max(0, t - 1)), 1000);
      setTick(interval);
    }
  }, [interval, selectedVm]);

  const sev        = result?.severity || "normal";
  const sevColor   = sev === "critical" ? C.red : sev === "warning" ? C.orange : C.green;
  const sevLight   = sev === "critical" ? C.redLight : sev === "warning" ? C.orangeLight : C.greenLight;
  const sevBorder  = sev === "critical" ? C.redBorder : sev === "warning" ? C.orangeBorder : C.greenBorder;
  const sevLabel   = sev === "critical" ? "CRITIQUE" : sev === "warning" ? "WARNING" : "NORMAL";

  const m = result?.metrics || {};
  const tickPct = interval > 0 ? (tick / interval) * 100 : 0;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Instrument+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin  { to { transform:rotate(360deg) } }
        @keyframes slideIn { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:translateX(0)} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width:4px }
        ::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12); border-radius:4px }
        select { appearance:none; -webkit-appearance:none; }
      `}</style>

      <div style={{ minHeight: "100vh", background: C.bg, fontFamily: SANS, color: C.ink }}>

        {/* ══ TOPBAR ══════════════════════════════════════════════════════════ */}
        <header style={{
          height: 58, padding: "0 32px",
          background: C.surface, borderBottom: `1px solid ${C.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, zIndex: 100,
          boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: C.accent, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, fontFamily: DISP, letterSpacing: "-0.02em" }}>
                ML Anomaly Analyzer
              </div>
              <div style={{ fontSize: 10, color: C.inkMuted, fontFamily: MONO }}>
                Isolation Forest · Real-time
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {running && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, background: C.greenLight, border: `1px solid ${C.greenBorder}` }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green, animation: "pulse 1.5s infinite" }}/>
                <span style={{ fontSize: 10, fontWeight: 600, color: C.green, fontFamily: MONO }}>LIVE</span>
              </div>
            )}
            {result && (
              <div style={{
                padding: "5px 14px", borderRadius: 6,
                background: sevLight, border: `1px solid ${sevBorder}`,
                fontSize: 10, fontWeight: 700, color: sevColor, fontFamily: MONO,
                letterSpacing: "0.08em",
              }}>
                {sevLabel}
              </div>
            )}
            {result?.vm && (
              <div style={{ fontSize: 11, color: C.inkMuted, fontFamily: MONO }}>
                {result.vm}
              </div>
            )}
          </div>
        </header>

        {/* ══ MAIN ════════════════════════════════════════════════════════════ */}
        <main style={{ padding: "28px 32px", maxWidth: 1280, margin: "0 auto" }}>

          {/* ─ Controls bar ─────────────────────────────────────────────────── */}
          <div style={{
            background: C.surface, borderRadius: 12, padding: "18px 22px",
            border: `1px solid ${C.border}`, boxShadow: C.shadow,
            display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap",
            marginBottom: 20,
          }}>

            {/* VM selector */}
            <div style={{ flex: "1 1 200px" }}>
              <label style={{ display: "block", fontSize: 10, color: C.inkMuted, fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
                Machine Virtuelle
              </label>
              <div style={{ position: "relative" }}>
                <select value={selectedVm} onChange={e => { setSelectedVm(e.target.value); setResult(null); }}
                  style={{
                    width: "100%", padding: "9px 36px 9px 12px",
                    borderRadius: 8, border: `1px solid ${C.borderMed}`,
                    background: C.surface, color: C.ink,
                    fontSize: 13, fontFamily: MONO, cursor: "pointer", outline: "none",
                  }}>
                  {vms.map(v => (
                    <option key={v.name} value={v.name}>
                      {v.state === "online" ? "● " : "○ "}{v.name}
                    </option>
                  ))}
                  {vms.length === 0 && <option value="">Chargement…</option>}
                </select>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.inkMuted} strokeWidth="2.5" strokeLinecap="round"
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>

            {/* Window */}
            <div style={{ flex: "0 0 140px" }}>
              <label style={{ display: "block", fontSize: 10, color: C.inkMuted, fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
                Fenêtre
              </label>
              <div style={{ position: "relative" }}>
                <select value={windowMin} onChange={e => setWindowMin(Number(e.target.value))}
                  style={{
                    width: "100%", padding: "9px 36px 9px 12px",
                    borderRadius: 8, border: `1px solid ${C.borderMed}`,
                    background: C.surface, color: C.ink,
                    fontSize: 13, fontFamily: MONO, cursor: "pointer", outline: "none",
                  }}>
                  {[5, 15, 30, 60, 120].map(v => <option key={v} value={v}>{v} min</option>)}
                </select>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.inkMuted} strokeWidth="2.5" strokeLinecap="round"
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>

            {/* Refresh interval */}
            <div style={{ flex: "0 0 150px" }}>
              <label style={{ display: "block", fontSize: 10, color: C.inkMuted, fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
                Intervalle
              </label>
              <div style={{ position: "relative" }}>
                <select value={interval} onChange={e => setIntervalS(Number(e.target.value))}
                  style={{
                    width: "100%", padding: "9px 36px 9px 12px",
                    borderRadius: 8, border: `1px solid ${C.borderMed}`,
                    background: C.surface, color: C.ink,
                    fontSize: 13, fontFamily: MONO, cursor: "pointer", outline: "none",
                  }}>
                  {[10, 15, 30, 60].map(v => <option key={v} value={v}>/{v}s</option>)}
                </select>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.inkMuted} strokeWidth="2.5" strokeLinecap="round"
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", gap: 8, flex: "0 0 auto" }}>
              <button onClick={() => runAnalysis()}
                disabled={loading}
                style={{
                  padding: "9px 18px", borderRadius: 8,
                  border: `1px solid ${C.borderMed}`,
                  background: C.surfaceAlt, color: C.inkSub,
                  fontSize: 12, fontWeight: 600, fontFamily: MONO,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                {loading ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                )}
                Analyser
              </button>

              <button onClick={startStop}
                style={{
                  padding: "9px 22px", borderRadius: 8,
                  border: `1.5px solid ${running ? C.red : C.accent}`,
                  background: running ? C.redLight : C.accent,
                  color: running ? C.red : "#fff",
                  fontSize: 12, fontWeight: 700, fontFamily: MONO,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                  transition: "all 0.2s",
                }}>
                {running ? (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill={C.red} stroke="none">
                      <rect x="4" y="4" width="6" height="16" rx="1"/><rect x="14" y="4" width="6" height="16" rx="1"/>
                    </svg>
                    STOP
                  </>
                ) : (
                  <>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff" stroke="none">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    START
                  </>
                )}
              </button>
            </div>

            {/* Tick bar */}
            {running && (
              <div style={{ flex: "1 1 100%", marginTop: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: C.inkMuted, fontFamily: MONO }}>Prochain scan</span>
                  <span style={{ fontSize: 10, color: C.inkSub, fontFamily: MONO, fontWeight: 600 }}>{tick}s</span>
                </div>
                <div style={{ height: 2, background: C.border, borderRadius: 2, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${tickPct}%`,
                    background: tickPct < 20 ? C.red : C.accent,
                    borderRadius: 2, transition: "width 1s linear, background 0.3s",
                  }}/>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div style={{
              padding: "12px 16px", borderRadius: 10,
              background: C.redLight, border: `1px solid ${C.redBorder}`,
              color: C.red, fontSize: 12, fontFamily: MONO, marginBottom: 16,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="1" fill={C.red}/>
              </svg>
              {error} — Vérifiez que le service ml-analyzer.local est accessible
            </div>
          )}

          {/* ─ Main grid ──────────────────────────────────────────────────── */}
          {result ? (
            <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, animation: "fadeUp 0.3s ease" }}>

              {/* ── LEFT COLUMN ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Gauge card */}
                <div style={{
                  background: C.surface, borderRadius: 14, padding: "24px 20px",
                  border: `1px solid ${C.border}`, boxShadow: C.shadow, textAlign: "center",
                }}>
                  <div style={{ fontSize: 10, color: C.inkMuted, fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                    Score d'anomalie
                  </div>
                  <Gauge score={result.anomaly_score} severity={sev}/>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 6, marginTop: 14,
                    padding: "6px 16px", borderRadius: 20,
                    background: sevLight, border: `1px solid ${sevBorder}`,
                    color: sevColor, fontSize: 11, fontWeight: 700, fontFamily: MONO,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: sevColor, animation: sev === "critical" ? "pulse 1.2s infinite" : "none" }}/>
                    {sevLabel}
                    {result.anomaly_detected && " · ANOMALIE"}
                  </div>
                  <div style={{ fontSize: 10, color: C.inkMuted, fontFamily: MONO, marginTop: 10 }}>
                    {result.window_size} points · fenêtre {windowMin}min
                  </div>
                </div>

                {/* Score sparkline */}
                {scoreHistory.length > 1 && (
                  <div style={{
                    background: C.surface, borderRadius: 12, padding: "16px 18px",
                    border: `1px solid ${C.border}`, boxShadow: C.shadow,
                  }}>
                    <div style={{ fontSize: 10, color: C.inkMuted, fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                      Historique des scores
                    </div>
                    <Sparkline values={scoreHistory} color={sevColor} height={48} width={290}/>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 9, color: C.inkMuted, fontFamily: MONO }}>–{scoreHistory.length * interval}s</span>
                      <span style={{ fontSize: 9, color: C.inkMuted, fontFamily: MONO }}>maintenant</span>
                    </div>
                  </div>
                )}

                {/* Raisons */}
                <div style={{
                  background: C.surface, borderRadius: 12, padding: "16px 18px",
                  border: `1px solid ${C.border}`, boxShadow: C.shadow,
                }}>
                  <div style={{ fontSize: 10, color: C.inkMuted, fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                    Seuils dépassés
                  </div>
                  {result.reasons?.length > 0 ? result.reasons.map((r, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 10px", borderRadius: 7, marginBottom: 6,
                      background: C.redLight, border: `1px solid ${C.redBorder}`,
                    }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth="2.5" strokeLinecap="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                      </svg>
                      <span style={{ fontSize: 12, color: C.red, fontFamily: MONO, fontWeight: 600 }}>{r}</span>
                    </div>
                  )) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 7, background: C.greenLight, border: `1px solid ${C.greenBorder}` }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={C.green} strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      <span style={{ fontSize: 12, color: C.green, fontFamily: MONO }}>Aucun seuil dépassé</span>
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT COLUMN ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Metrics grid */}
                <div style={{
                  background: C.surface, borderRadius: 14, padding: "20px 22px",
                  border: `1px solid ${C.border}`, boxShadow: C.shadow,
                }}>
                  <div style={{ fontSize: 10, color: C.inkMuted, fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                    Métriques en temps réel
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <MetricPill label="CPU"       value={m.cpu_pct?.toFixed(1) ?? "—"}          unit="%" color={C.blue}   light={C.blueLight}   border={C.blueBorder}/>
                    <MetricPill label="RAM"       value={m.mem_pct?.toFixed(1) ?? "—"}          unit="%" color="#7B2D8B" light="#F5EDF8"       border="#D9B8E3"/>
                    <MetricPill label="Disk"      value={m.disk_used_pct?.toFixed(1) ?? "—"}    unit="%" color={C.orange} light={C.orangeLight} border={C.orangeBorder}/>
                    <MetricPill label="Latence"   value={m.disk_latency_ms?.toFixed(0) ?? "—"}  unit="ms" color={C.inkSub} light={C.surfaceAlt} border={C.border}/>
                    <MetricPill label="CPU Ready" value={m.cpu_ready?.toFixed(1) ?? "—"}        unit="ms" color={C.inkSub} light={C.surfaceAlt} border={C.border}/>
                    <MetricPill label="Swap"      value={m.mem_swap_kb?.toFixed(0) ?? "—"}      unit="KB" color={m.mem_swap_kb > 500 ? C.red : C.inkSub} light={m.mem_swap_kb > 500 ? C.redLight : C.surfaceAlt} border={m.mem_swap_kb > 500 ? C.redBorder : C.border}/>
                    <MetricPill label="Net RX"    value={m.net_rx_kbps?.toFixed(0) ?? "—"}      unit="kbps" color={C.green} light={C.greenLight} border={C.greenBorder}/>
                    <MetricPill label="Net TX"    value={m.net_tx_kbps?.toFixed(0) ?? "—"}      unit="kbps" color={C.green} light={C.greenLight} border={C.greenBorder}/>
                    <MetricPill label="Drops"     value={m.net_drops?.toFixed(0) ?? "—"}        unit="" color={m.net_drops > 50 ? C.red : C.inkMuted} light={m.net_drops > 50 ? C.redLight : C.surfaceAlt} border={m.net_drops > 50 ? C.redBorder : C.border}/>
                    <MetricPill label="Erreurs"   value={m.log_error_count ?? "—"}              unit="" color={m.log_error_count > 10 ? C.red : C.inkSub} light={m.log_error_count > 10 ? C.redLight : C.surfaceAlt} border={m.log_error_count > 10 ? C.redBorder : C.border}/>
                    <MetricPill label="OOM"       value={m.log_oom ?? "—"}                      unit="" color={m.log_oom > 0 ? C.red : C.green} light={m.log_oom > 0 ? C.redLight : C.greenLight} border={m.log_oom > 0 ? C.redBorder : C.greenBorder}/>
                    <MetricPill label="Restarts"  value={m.log_restarts ?? "—"}                 unit="" color={m.log_restarts > 1 ? C.red : C.inkSub} light={m.log_restarts > 1 ? C.redLight : C.surfaceAlt} border={m.log_restarts > 1 ? C.redBorder : C.border}/>
                  </div>
                </div>

                {/* Top features */}
                {result.top_features?.length > 0 && (
                  <div style={{
                    background: C.surface, borderRadius: 12, padding: "18px 20px",
                    border: `1px solid ${C.border}`, boxShadow: C.shadow,
                  }}>
                    <div style={{ fontSize: 10, color: C.inkMuted, fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                      Top features déviantes (z-score)
                    </div>
                    {result.top_features.map((f, i) => (
                      <ZBar key={i} feature={f.feature} value={f.value} z={f.z_score}/>
                    ))}
                  </div>
                )}

                {/* Log features */}
                <div style={{
                  background: C.surface, borderRadius: 12, padding: "18px 20px",
                  border: `1px solid ${C.border}`, boxShadow: C.shadow,
                }}>
                  <div style={{ fontSize: 10, color: C.inkMuted, fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                    Logs Loki — Features extraites
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Error rate",  value: ((m.log_error_rate ?? 0) * 100).toFixed(1) + "%", hi: m.log_error_rate > 0.2 },
                      { label: "HTTP 5xx",    value: m.log_http5xx ?? 0,   hi: m.log_http5xx > 5 },
                      { label: "Timeouts",    value: m.log_timeout ?? 0,   hi: m.log_timeout > 3 },
                      { label: "Critical",    value: m.log_critical ?? 0,  hi: m.log_critical > 0 },
                      { label: "Warnings",    value: m.log_warn_count ?? 0, hi: false },
                      { label: "Total logs",  value: m.log_total ?? 0,     hi: false },
                    ].map(({ label, value, hi }) => (
                      <div key={label} style={{
                        padding: "10px 12px", borderRadius: 8,
                        background: hi ? C.redLight : C.surfaceAlt,
                        border: `1px solid ${hi ? C.redBorder : C.border}`,
                        textAlign: "center",
                      }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: hi ? C.red : C.inkSub, fontFamily: MONO, lineHeight: 1 }}>
                          {value}
                        </div>
                        <div style={{ fontSize: 9, color: hi ? C.red : C.inkMuted, fontFamily: MONO, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : !loading && (
            <div style={{
              textAlign: "center", padding: "64px 32px",
              background: C.surface, borderRadius: 14,
              border: `1px solid ${C.border}`, boxShadow: C.shadow,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16,
                background: C.accent, display: "flex", alignItems: "center",
                justifyContent: "center", margin: "0 auto 16px",
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: C.ink, fontFamily: DISP, marginBottom: 6 }}>
                Prêt à analyser
              </div>
              <div style={{ fontSize: 13, color: C.inkMuted, fontFamily: MONO }}>
                Lance START pour l'analyse en continu, ou Analyser pour un scan unique
              </div>
            </div>
          )}

          {/* ─ History ──────────────────────────────────────────────────────── */}
          {history.length > 0 && (
            <div style={{
              marginTop: 16, background: C.surface, borderRadius: 14, padding: "20px 22px",
              border: `1px solid ${C.border}`, boxShadow: C.shadow,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 10, color: C.inkMuted, fontFamily: MONO, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Historique des analyses
                </div>
                <span style={{ fontSize: 10, color: C.inkMuted, fontFamily: MONO }}>{history.length} entrées</span>
              </div>
              <HistoryLine entries={history}/>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

