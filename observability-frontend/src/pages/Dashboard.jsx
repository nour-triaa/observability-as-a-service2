import { useState, useEffect, useCallback, useRef } from "react";
import CpuGraph from "../components/metrics/CpuGraph";
import DiskUsage from "../components/metrics/DiskUsage";
import PowerStatus from "../components/metrics/PowerStatus";
import NetworkGraph from "../components/metrics/NetworkGraph";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg:           "#f0f4f8",
  surface:      "#ffffff",
  surfaceAlt:   "#f7f9fc",
  surfaceHover: "#eef2f7",
  border:       "rgba(0,0,0,0.07)",
  borderMed:    "rgba(0,0,0,0.11)",
  text:         "#0f172a",
  textSub:      "#475569",
  textMuted:    "#94a3b8",
  blue:         "#2563eb",
  blueLight:    "#eff6ff",
  blueBorder:   "#bfdbfe",
  green:        "#16a34a",
  greenLight:   "#f0fdf4",
  greenBorder:  "#bbf7d0",
  red:          "#dc2626",
  redLight:     "#fef2f2",
  redBorder:    "#fecaca",
  orange:       "#ea580c",
  orangeLight:  "#fff7ed",
  orangeBorder: "#fed7aa",
  purple:       "#7c3aed",
  purpleLight:  "#f5f3ff",
  purpleBorder: "#ddd6fe",
  cyan:         "#0891b2",
  cyanLight:    "#ecfeff",
  cyanBorder:   "#a5f3fc",
  yellow:       "#ca8a04",
  yellowLight:  "#fefce8",
  yellowBorder: "#fde68a",
  shadow:       "0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.04)",
  shadowMd:     "0 4px 10px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.06)",
  shadowLg:     "0 8px 24px rgba(0,0,0,0.10), 0 24px 64px rgba(0,0,0,0.08)",
};

const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const SANS = "'DM Sans', system-ui, sans-serif";

// ─── API endpoints ────────────────────────────────────────────────────────────
const PROM          = "http://prometheus.local/api/v1/query";
const PROM_RANGE    = "http://prometheus.local/api/v1/query_range";
const LOKI_URL      = "http://loki.local/loki/api/v1";
const SIGNOZ_ALERTS = "http://alerts.local/api/alerts";
const VEEAM_URL = "http://veeam-collector.local/data";

// ─── Fetch Function ─────────────────────────────────────────────────────────
async function fetchVeeamJob() {
  try {
    const res = await fetch(VEEAM_URL);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error("Erreur fetch Veeam:", error);
    return null;
  }
}

// ─── VeeamBackupCard - Design Professionnel ───────────────────────────────────
// ─── VeeamBackupCard - Design Professionnel Observabilité ─────────────────────
// DROP-IN REPLACEMENT — aucune logique modifiée, uniquement le rendu visuel.
// Remplace l'intégralité de la fonction VeeamBackupCard dans Dashboard.jsx

function VeeamBackupCard({ data }) {
  const isLoading = data === undefined;
  const noData    = data === null;

  const jobs         = Array.isArray(data?.jobs) ? data.jobs : [];
  const collectedAt  = data?.collected_at;
  const global       = data?.global || {};

  // ── Calculs (identiques à l'original) ──────────────────────────────────────
  const rpoValues = jobs.map(j => j.rpo?.minutes).filter(m => typeof m === "number");
  const rtoValues = jobs.map(j => j.rto?.minutes).filter(m => typeof m === "number");
  const avgRPO    = rpoValues.length > 0 ? Math.round(rpoValues.reduce((a,b) => a+b,0) / rpoValues.length) : null;
  const avgRTO    = rtoValues.length > 0 ? Math.round(rtoValues.reduce((a,b) => a+b,0) / rtoValues.length) : null;

  const fmtMinutes = (minutes) => {
    if (minutes === null || minutes === undefined) return "—";
    const d = Math.floor(minutes / 1440);
    const h = Math.floor((minutes % 1440) / 60);
    const m = minutes % 60;
    const parts = [];
    if (d) parts.push(`${d}j`);
    if (h) parts.push(`${h}h`);
    if (m || parts.length === 0) parts.push(`${m}m`);
    return parts.join(" ");
  };

  // ── États de chargement / vide ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <GraphBox>
        <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {[0,1,2].map(i => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: "50%", background: T.blue,
                animation: "blink 1.4s ease-in-out infinite",
                animationDelay: `${i * 0.22}s`,
              }}/>
            ))}
          </div>
        </div>
      </GraphBox>
    );
  }

  if (noData || jobs.length === 0) {
    return (
      <GraphBox>
        <div style={{ padding: "48px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>⚠</div>
          <div style={{ fontSize: 13, color: T.textMuted, fontFamily: MONO }}>Aucune donnée Veeam disponible</div>
        </div>
      </GraphBox>
    );
  }

  // ── Couleurs helpers ────────────────────────────────────────────────────────
  const slaColor  = pct => pct > 90 ? T.green : T.red;
  const lastCollect = collectedAt ? new Date(collectedAt).toLocaleString("fr-FR") : "—";
  const slaGlobal   = global.sla_pct;

  return (
    <div style={{ marginBottom: 20 }}>
      <SectionLabel>Backup & Replication</SectionLabel>

      {/* ────────────────────────────── HEADER PANEL ──────────────────────────── */}
      <div style={{
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        marginBottom: 14,
        overflow: "hidden",
        boxShadow: T.shadow,
      }}>
        {/* bande accent haut */}
        <div style={{
          height: 3,
          background: `linear-gradient(90deg, ${T.blue} 0%, ${T.purple} 50%, ${T.cyan} 100%)`,
        }}/>

        <div style={{ padding: "20px 24px" }}>
          {/* Titre + timestamp */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Icône */}
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "linear-gradient(135deg, #eff6ff 0%, #f5f3ff 100%)",
                border: `1px solid ${T.blueBorder}`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="1.8" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: T.text, fontFamily: SANS, letterSpacing: "-0.01em" }}>
                  État des Sauvegardes
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, fontFamily: MONO, marginTop: 2 }}>
                  {jobs.length} job{jobs.length > 1 ? "s" : ""} · collecté le {lastCollect}
                </div>
              </div>
            </div>
            {/* Badge SLA global */}
            <div style={{
              padding: "6px 14px",
              borderRadius: 8,
              background: slaGlobal > 90 ? T.greenLight : T.redLight,
              border: `1px solid ${slaGlobal > 90 ? T.greenBorder : T.redBorder}`,
              display: "flex", flexDirection: "column", alignItems: "center",
            }}>
              <span style={{ fontSize: 9, color: slaGlobal > 90 ? T.green : T.red, fontFamily: MONO, letterSpacing: "0.1em", textTransform: "uppercase" }}>SLA 30 j</span>
              <span style={{ fontSize: 18, fontWeight: 900, color: slaGlobal > 90 ? T.green : T.red, fontFamily: MONO, lineHeight: 1.2 }}>
                {slaGlobal ? `${slaGlobal}%` : "—"}
              </span>
            </div>
          </div>

          {/* Métriques globales en 4 colonnes */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 1,
            background: T.border,
            borderRadius: 10,
            overflow: "hidden",
          }}>
            {[
              {
                label: "RPO Moyen",
                value: fmtMinutes(avgRPO),
                color: T.orange,
                bg: T.orangeLight,
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.orange} strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                  </svg>
                ),
              },
              {
                label: "RTO Moyen",
                value: fmtMinutes(avgRTO),
                color: T.blue,
                bg: T.blueLight,
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                ),
              },
              {
                label: "Succès",
                value: global.count_ok ?? 0,
                color: T.green,
                bg: T.greenLight,
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2.2" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ),
              },
              {
                label: "Échecs",
                value: global.count_failed ?? 0,
                color: (global.count_failed ?? 0) > 0 ? T.red : T.textMuted,
                bg: (global.count_failed ?? 0) > 0 ? T.redLight : T.surfaceAlt,
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={(global.count_failed ?? 0) > 0 ? T.red : T.textMuted} strokeWidth="2.2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                ),
              },
            ].map(({ label, value, color, bg, icon }) => (
              <div key={label} style={{ background: T.surface, padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
                  <span style={{ fontSize: 10, color: T.textMuted, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color, fontFamily: MONO, lineHeight: 1 }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ────────────────────────────── JOB CARDS ─────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(440px, 1fr))", gap: 14 }}>
        {jobs.map((job, index) => {
          const isRunning   = job.is_running === true;
          const lastResult  = job.last_result || "—";

          const stateColor =
            isRunning       ? T.blue  :
            lastResult === "Failed"  ? T.red   :
            lastResult === "Warning" ? T.orange : T.green;

          const stateLight =
            isRunning       ? T.blueLight  :
            lastResult === "Failed"  ? T.redLight   :
            lastResult === "Warning" ? T.orangeLight : T.greenLight;

          const stateBorder =
            isRunning       ? T.blueBorder  :
            lastResult === "Failed"  ? T.redBorder   :
            lastResult === "Warning" ? T.orangeBorder : T.greenBorder;

          const stateLabel  = isRunning ? "EN COURS" : lastResult;

          return (
            <div
              key={index}
              style={{
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: T.shadow,
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = T.shadowMd;
                e.currentTarget.style.borderColor = T.borderMed;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = T.shadow;
                e.currentTarget.style.borderColor = T.border;
              }}
            >
              {/* Barre de statut en haut */}
              <div style={{ height: 2, background: stateColor, opacity: 0.8 }}/>

              <div style={{ padding: "20px 22px" }}>
                {/* Header Job */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                    {/* Dot statut */}
                    <div style={{
                      width: 8, height: 8, borderRadius: "50%", background: stateColor, flexShrink: 0,
                      animation: isRunning ? "blink 2s ease-in-out infinite" : "none",
                    }}/>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: T.text, fontFamily: MONO, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {job.job_name}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted, fontFamily: SANS, marginTop: 2 }}>
                        {job.type}{job.repository ? ` · ${job.repository}` : ""}
                      </div>
                    </div>
                  </div>

                  {/* Badge état */}
                  <div style={{
                    padding: "4px 12px",
                    borderRadius: 6,
                    background: stateLight,
                    border: `1px solid ${stateBorder}`,
                    color: stateColor,
                    fontSize: 10,
                    fontWeight: 800,
                    fontFamily: MONO,
                    letterSpacing: "0.06em",
                    flexShrink: 0,
                    marginLeft: 10,
                    display: "flex", alignItems: "center", gap: 5,
                  }}>
                    {isRunning && <span style={{ width: 5, height: 5, borderRadius: "50%", background: stateColor, animation: "blink 1.5s infinite", display: "block" }}/>}
                    {stateLabel}
                  </div>
                </div>

                {/* Progress Bar si job en cours */}
                {isRunning && job.progress && (
                  <div style={{
                    margin: "16px 0",
                    padding: "14px 16px",
                    background: T.blueLight,
                    border: `1px solid ${T.blueBorder}`,
                    borderRadius: 10,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: T.blue, fontFamily: MONO, fontWeight: 600 }}>Progression</span>
                      <span style={{ fontSize: 13, fontWeight: 900, color: T.blue, fontFamily: MONO }}>{job.progress.pct || 0}%</span>
                    </div>
                    {/* Track segmenté */}
                    <div style={{ height: 6, background: "rgba(37,99,235,0.15)", borderRadius: 999, overflow: "hidden", position: "relative" }}>
                      <div style={{
                        width: `${job.progress.pct || 0}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #2563eb 0%, #60a5fa 100%)",
                        borderRadius: 999,
                        transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                      }}/>
                    </div>
                    <div style={{ fontSize: 11, color: T.blue, fontFamily: MONO, marginTop: 8, display: "flex", gap: 12 }}>
                      <span>{job.progress.processed_gb} GB / {job.progress.total_gb} GB</span>
                      {job.progress.speed_mbs && <span style={{ opacity: 0.7 }}>· {job.progress.speed_mbs} MB/s</span>}
                    </div>
                  </div>
                )}

                {/* Séparateur */}
                <div style={{ height: 1, background: T.border, margin: "16px 0" }}/>

                {/* Métriques RPO / RTO / SLA */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {[
                    { label: "RPO",     value: job.rpo?.human   || "—", color: T.orange, bg: T.orangeLight, border: T.orangeBorder },
                    { label: "RTO",     value: job.rto?.human   || "—", color: T.blue,   bg: T.blueLight,   border: T.blueBorder   },
                    { label: "SLA 30j", value: job.sla_30d?.pct ? `${job.sla_30d.pct}%` : "—",
                      color: job.sla_30d?.pct ? slaColor(job.sla_30d.pct) : T.textMuted,
                      bg:    job.sla_30d?.pct ? (job.sla_30d.pct > 90 ? T.greenLight : T.redLight) : T.surfaceAlt,
                      border: job.sla_30d?.pct ? (job.sla_30d.pct > 90 ? T.greenBorder : T.redBorder) : T.border,
                    },
                  ].map(({ label, value, color, bg, border }) => (
                    <div key={label} style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: bg,
                      border: `1px solid ${border}`,
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 9, color: T.textMuted, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>{label}</div>
                      <div style={{ fontSize: 16, fontWeight: 900, color, fontFamily: MONO, lineHeight: 1 }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Dates */}
                <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 5 }}>
                  {[
                    {
                      label: "Dernier succès",
                      value: job.last_success_time ? new Date(job.last_success_time).toLocaleString("fr-FR") : "Jamais",
                      color: T.text,
                      dot: T.green,
                    },
                    {
                      label: "Dernier échec",
                      value: job.last_failed_time ? new Date(job.last_failed_time).toLocaleString("fr-FR") : "Aucun",
                      color: job.has_failed_recently ? T.red : T.textMuted,
                      dot: job.has_failed_recently ? T.red : T.border,
                    },
                  ].map(({ label, value, color, dot }) => (
                    <div key={label} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "7px 10px",
                      borderRadius: 7,
                      background: T.surfaceAlt,
                      border: `1px solid ${T.border}`,
                    }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: dot, flexShrink: 0 }}/>
                      <span style={{ fontSize: 11, color: T.textMuted, fontFamily: MONO, minWidth: 90 }}>{label}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color, fontFamily: MONO, marginLeft: "auto" }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Prometheus ───────────────────────────────────────────────────────────────
async function pq(query) {
  try {
    const res  = await fetch(`${PROM}?query=${encodeURIComponent(query)}`);
    const json = await res.json();
    return json.status === "success" ? json.data.result : [];
  } catch { return []; }
}
function firstVal(results, fallback = 0) {
  return results[0] ? parseFloat(results[0].value[1]) : fallback;
}

// ─── Loki ─────────────────────────────────────────────────────────────────────
async function fetchRecentLogs(limit = 10) {
  try {
    const end   = (Date.now() * 1e6).toString();
    const start = ((Date.now() - 10 * 60 * 1000) * 1e6).toString();
    const query = '{job="esxi"} != "envoy-access"';
    const url   = `${LOKI_URL}/query_range?query=${encodeURIComponent(query)}&limit=${limit}&start=${start}&end=${end}&direction=backward`;
    const res   = await fetch(url);
    if (!res.ok) return [];
    const json  = await res.json();
    const vals  = json?.data?.result?.[0]?.values || [];
    return vals.map(([ts, line]) => ({ ts: parseInt(ts), line }));
  } catch { return []; }
}

async function fetchErrorCount(expr, win = "5m") {
  try {
    const q   = `sum(count_over_time(${expr} [${win}]))`;
    const res = await fetch(`${LOKI_URL}/query?query=${encodeURIComponent(q)}&time=${Math.floor(Date.now()/1000)}`);
    const j   = await res.json();
    const v   = j?.data?.result?.[0]?.value?.[1];
    return v ? parseInt(v) : 0;
  } catch { return 0; }
}

// ─── SigNoz Alerts ───────────────────────────────────────────────────────────
async function fetchSigNozAlerts() {
  try {
    const res = await fetch(SIGNOZ_ALERTS);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ─── Alert type detector ──────────────────────────────────────────────────────
function detectAlertType(alert) {
  const s = ((alert.name || "") + " " + (alert.message || "")).toLowerCase();
  if (s.includes("login")   || s.includes("logged in"))   return { type: "Connexion",   icon: "🔑", color: T.cyan,   light: T.cyanLight   };
  if (s.includes("logout")  || s.includes("logged out"))  return { type: "Déconnexion", icon: "🚪", color: T.blue,   light: T.blueLight   };
  if (s.includes("timeout") || s.includes("timed out"))   return { type: "Timeout",     icon: "⏱",  color: T.orange, light: T.orangeLight };
  if (s.includes("disk")    || s.includes("filesystem"))  return { type: "Stockage",    icon: "💾", color: T.purple, light: T.purpleLight };
  if (s.includes("cpu"))                                   return { type: "CPU",         icon: "⚡", color: T.orange, light: T.orangeLight };
  if (s.includes("memory")  || s.includes("ram"))         return { type: "Mémoire",     icon: "🧠", color: T.purple, light: T.purpleLight };
  if (s.includes("error")   || s.includes("erreur"))      return { type: "Erreur",      icon: "✕",  color: T.red,    light: T.redLight    };
  if (s.includes("warning") || s.includes("warn"))        return { type: "Alerte",      icon: "⚠",  color: T.yellow, light: T.yellowLight };
  if (s.includes("restart") || s.includes("reboot"))      return { type: "Redémarrage", icon: "↺",  color: T.blue,   light: T.blueLight   };
  return { type: "Info", icon: "ℹ", color: T.blue, light: T.blueLight };
}

// ─── NotificationBar ─────────────────────────────────────────────────────────
function NotificationBar({ alerts }) {
  const [open,      setOpen]      = useState(false);
  const [filter,    setFilter]    = useState("all");
  const [sel,       setSel]       = useState(null);
  const [readCount, setReadCount] = useState(0);
  const ref                       = useRef(null);

  const active   = alerts.filter(a => !a.resolved);
  const resolved = alerts.filter(a =>  a.resolved);
  const critical = active.filter(a => a.severity === "critical");
  const warning  = active.filter(a => a.severity === "warning");
  const unread   = Math.max(0, active.length - readCount);

  useEffect(() => {
    if (!open) setReadCount(prev => Math.min(prev, active.length));
  }, [active.length, open]);

  useEffect(() => {
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSel(null); }
    };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const filtered = filter === "active"   ? active
                 : filter === "critical" ? critical
                 : filter === "warning"  ? warning
                 : filter === "resolved" ? resolved
                 : alerts;

  const sevColor = s => s === "critical" ? T.red : s === "warning" ? T.orange : T.blue;
  const sevLight = s => s === "critical" ? T.redLight : s === "warning" ? T.orangeLight : T.blueLight;

  const handleToggle = () => {
    if (!open) setReadCount(active.length);
    setOpen(o => !o);
    setSel(null);
  };

  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button onClick={handleToggle} style={{
        position:"relative", width:40, height:40, borderRadius:10,
        border:`1.5px solid ${unread > 0 ? T.redBorder : T.border}`,
        background: unread > 0 ? T.redLight : T.surface,
        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
        transition:"all 0.18s", boxShadow: T.shadow,
      }}
      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow=T.shadowMd; }}
      onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)";    e.currentTarget.style.boxShadow=T.shadow;   }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={unread > 0 ? T.red : T.textSub} strokeWidth="2" strokeLinecap="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={{
            position:"absolute", top:-5, right:-5,
            minWidth:18, height:18, borderRadius:9, padding:"0 4px",
            background:T.red, color:"#fff", fontSize:9, fontWeight:700, fontFamily:MONO,
            display:"flex", alignItems:"center", justifyContent:"center", border:"2px solid #fff",
          }}>{unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position:"absolute", top:50, right:0, width:460, zIndex:1000,
          background:T.surface, border:`1px solid ${T.border}`,
          borderRadius:16, boxShadow:T.shadowLg, overflow:"hidden", animation:"fadeUp 0.18s ease",
        }}>
          <div style={{ padding:"18px 20px 14px", borderBottom:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:T.text, fontFamily:SANS }}>Notifications</div>
                <div style={{ fontSize:11, color:T.textMuted, fontFamily:MONO, marginTop:1 }}>
                  {active.length} active{active.length !== 1?"s":""} · {resolved.length} résolue{resolved.length!==1?"s":""}
                </div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                {critical.length > 0 && (
                  <span style={{ fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20, background:T.redLight, color:T.red, fontFamily:MONO, border:`1px solid ${T.redBorder}` }}>
                    {critical.length} critique{critical.length > 1?"s":""}
                  </span>
                )}
                {warning.length > 0 && (
                  <span style={{ fontSize:10, fontWeight:700, padding:"3px 10px", borderRadius:20, background:T.yellowLight, color:T.yellow, fontFamily:MONO, border:`1px solid ${T.yellowBorder}` }}>
                    {warning.length} warning{warning.length > 1?"s":""}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display:"flex", gap:4 }}>
              {[
                { k:"all",      l:`Toutes (${alerts.length})` },
                { k:"active",   l:`Actives (${active.length})` },
                { k:"critical", l:`Critiques` },
                { k:"warning",  l:`Warnings` },
                { k:"resolved", l:`Résolues` },
              ].map(f => (
                <button key={f.k} onClick={() => { setFilter(f.k); setSel(null); }} style={{
                  padding:"5px 11px", borderRadius:8, border:"none", cursor:"pointer",
                  fontSize:10, fontWeight:600, fontFamily:SANS,
                  background: filter === f.k ? T.blue : T.surfaceAlt,
                  color:      filter === f.k ? "#fff" : T.textMuted,
                  transition:"all 0.12s",
                }}>{f.l}</button>
              ))}
            </div>
          </div>

          {sel !== null ? (() => {
            const alert = filtered[sel];
            const { type, icon, color, light } = detectAlertType(alert);
            const sc = alert.resolved ? T.green : sevColor(alert.severity);
            const sl = alert.resolved ? T.greenLight : sevLight(alert.severity);
            return (
              <div style={{ padding:"20px" }}>
                <button onClick={() => setSel(null)} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", color:T.textMuted, fontSize:12, fontFamily:SANS, marginBottom:16, padding:0 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Retour
                </button>
                <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
                  <div style={{ width:48, height:48, borderRadius:14, background:light, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>{icon}</div>
                  <div>
                    <div style={{ fontSize:16, fontWeight:800, color:T.text, fontFamily:SANS }}>{alert.name}</div>
                    <div style={{ display:"flex", gap:6, marginTop:4 }}>
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:6, background:light, color, fontFamily:MONO }}>{type}</span>
                      <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:6, background:sl, color:sc, fontFamily:MONO }}>{alert.resolved?"RÉSOLU":(alert.severity||"info").toUpperCase()}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {[
                    { label:"Description", val: alert.message||"—" },
                    { label:"Statut",      val: alert.resolved?"Résolu":"Actif" },
                    { label:"Sévérité",    val: (alert.severity||"info").toUpperCase() },
                    { label:"Heure",       val: new Date(alert.timestamp).toLocaleString("fr-FR") },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ padding:"12px 16px", borderRadius:10, background:T.surfaceAlt, border:`1px solid ${T.border}` }}>
                      <div style={{ fontSize:10, color:T.textMuted, fontFamily:MONO, marginBottom:4 }}>{label}</div>
                      <div style={{ fontSize:13, color:T.text, fontFamily:SANS, fontWeight:500 }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })() : (
            <div style={{ maxHeight:360, overflowY:"auto" }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign:"center", padding:"40px 20px" }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>✓</div>
                  <div style={{ fontSize:13, color:T.green, fontFamily:SANS, fontWeight:600 }}>Aucune alerte</div>
                  <div style={{ fontSize:11, color:T.textMuted, fontFamily:MONO, marginTop:4 }}>Tout est opérationnel</div>
                </div>
              ) : filtered.map((alert, i) => {
                const { type, icon, color, light } = detectAlertType(alert);
                const sc = alert.resolved ? T.green : sevColor(alert.severity);
                return (
                  <div key={i} onClick={() => setSel(i)} style={{
                    padding:"14px 20px", cursor:"pointer",
                    borderBottom:`1px solid rgba(0,0,0,0.05)`,
                    borderLeft:`3px solid ${alert.resolved ? T.green : sc}`,
                    transition:"background 0.12s", display:"flex", alignItems:"center", gap:12,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background=T.surfaceHover}
                  onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                    <div style={{ width:36, height:36, borderRadius:10, background:light, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:16 }}>{icon}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:T.text, fontFamily:SANS }}>{alert.name}</span>
                        <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:6, background:light, color, fontFamily:MONO }}>{type}</span>
                        <span style={{ fontSize:9, fontWeight:700, padding:"2px 7px", borderRadius:6,
                          background: alert.resolved ? T.greenLight : sevLight(alert.severity),
                          color: alert.resolved ? T.green : sc, fontFamily:MONO, marginLeft:"auto", flexShrink:0 }}>
                          {alert.resolved?"RÉSOLU":(alert.severity||"info").toUpperCase()}
                        </span>
                      </div>
                      {alert.message && (
                        <div style={{ fontSize:11, color:T.textMuted, fontFamily:MONO, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{alert.message}</div>
                      )}
                      <div style={{ fontSize:10, color:T.textMuted, fontFamily:MONO, marginTop:2 }}>{new Date(alert.timestamp).toLocaleTimeString("fr-FR")}</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2" strokeLinecap="round" style={{ flexShrink:0 }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                );
              })}
            </div>
          )}

          {sel === null && (
            <div style={{ padding:"12px 20px", borderTop:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between", alignItems:"center", background:T.surfaceAlt }}>
              <span style={{ fontSize:10, color:T.textMuted, fontFamily:MONO }}>Actualisation automatique · 15s</span>
              <a href="http://signoz.local/alerts" target="_blank" rel="noreferrer"
                style={{ fontSize:11, color:T.blue, fontFamily:SANS, textDecoration:"none", fontWeight:600, display:"flex", alignItems:"center", gap:4 }}>
                Voir tout
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ state }) {
  const map = {
    Online:   { bg: T.greenLight,  border: T.greenBorder,  color: T.green,  label: "EN LIGNE"   },
    Offline:  { bg: T.redLight,    border: T.redBorder,    color: T.red,    label: "HORS LIGNE" },
    Unknown:  { bg: T.yellowLight, border: T.yellowBorder, color: T.yellow, label: "INCONNU"    },
    firing:   { bg: T.redLight,    border: T.redBorder,    color: T.red,    label: "ACTIF"      },
    pending:  { bg: T.yellowLight, border: T.yellowBorder, color: T.yellow, label: "EN ATTENTE" },
    resolved: { bg: T.greenLight,  border: T.greenBorder,  color: T.green,  label: "RÉSOLU"     },
  };
  const c = map[state] || map.Unknown;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", gap:5,
      padding:"4px 10px", borderRadius:20,
      background:c.bg, border:`1px solid ${c.border}`,
      color:c.color, fontSize:10, fontWeight:700,
      letterSpacing:"0.06em", fontFamily:MONO,
    }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:c.color, flexShrink:0, animation:(state==="Online"||state==="firing")?"blink 2.5s ease-in-out infinite":"none" }}/>
      {c.label}
    </span>
  );
}

// ─── MemoryBar ────────────────────────────────────────────────────────────────
function MemoryBar({ consumedKB, totalMB }) {
  const usedMB = consumedKB !== null ? consumedKB / 1024 : null;
  const pct    = usedMB !== null && totalMB ? Math.min((usedMB / totalMB) * 100, 100) : null;
  const isNA   = pct === null;
  const color  = isNA ? T.textMuted : pct > 85 ? T.red : pct > 65 ? T.orange : T.green;
  const track  = isNA ? T.border    : pct > 85 ? T.redLight : pct > 65 ? T.orangeLight : T.greenLight;
  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
        <span style={{ fontSize:10, color:T.textMuted, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:MONO }}>Mémoire</span>
        <span style={{ fontSize:12, fontWeight:700, color, fontFamily:MONO }}>{isNA ? "N/A" : `${pct.toFixed(0)}%`}</span>
      </div>
      <div style={{ height:5, background:track, borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:isNA?"0%":`${pct}%`, background:color, borderRadius:3, transition:"width 1s ease" }}/>
      </div>
      <div style={{ fontSize:11, color:T.textMuted, marginTop:4, fontFamily:MONO }}>
        {isNA ? "VMware Tools absent" : `${usedMB.toFixed(0)} MB / ${totalMB.toFixed(0)} MB`}
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.14em", color:T.textMuted, textTransform:"uppercase", margin:"22px 0 12px", fontFamily:MONO, display:"flex", alignItems:"center", gap:8 }}>
      <span style={{ flex:1, height:"1px", background:T.border }}/>
      {children}
      <span style={{ flex:1, height:"1px", background:T.border }}/>
    </div>
  );
}

function GraphBox({ children, tall = false }) {
  return (
    <div style={{ borderRadius:14, background:T.surface, border:`1px solid ${T.border}`, padding:tall?"22px 24px":"16px 18px", marginBottom:12, boxShadow:tall?T.shadowMd:T.shadow }}>
      {children}
    </div>
  );
}

function StatCard({ icon, label, value, bgColor, accent, sub }) {
  return (
    <div style={{
      background:T.surface, border:`1px solid ${T.border}`,
      borderTop:`3px solid ${accent}`, borderRadius:14,
      padding:"20px 22px", display:"flex", alignItems:"center", gap:16,
      flex:"1 1 160px", boxShadow:T.shadow, transition:"transform 0.2s, box-shadow 0.2s",
    }}
    onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow=T.shadowMd; }}
    onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)";    e.currentTarget.style.boxShadow=T.shadow;   }}>
      <div style={{ width:48, height:48, borderRadius:12, background:bgColor, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{icon}</div>
      <div>
        <div style={{ fontSize:34, fontWeight:900, color:T.text, lineHeight:1, fontFamily:MONO }}>{value}</div>
        <div style={{ fontSize:11, color:T.textMuted, marginTop:5, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:SANS }}>{label}</div>
        {sub && <div style={{ fontSize:11, color:accent, marginTop:3, fontFamily:MONO }}>{sub}</div>}
      </div>
    </div>
  );
}

function HostInfoBar({ hostData }) {
  if (!hostData) return null;
  const cpuPct   = hostData.cpuMax > 0 ? ((hostData.cpuUsage / hostData.cpuMax) * 100).toFixed(1) : 0;
  const memPct   = hostData.memMax > 0 ? ((hostData.memUsage / hostData.memMax) * 100).toFixed(1) : 0;
  const cpuColor = cpuPct > 80 ? T.red : cpuPct > 60 ? T.orange : T.blue;
  const memColor = memPct > 80 ? T.red : memPct > 60 ? T.orange : T.purple;
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"18px 24px", marginBottom:14, display:"flex", flexWrap:"wrap", alignItems:"center", boxShadow:T.shadow }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, paddingRight:24, marginRight:24, borderRight:`1px solid ${T.border}` }}>
        <div style={{ width:42, height:42, borderRadius:10, background:T.blueLight, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize:14, fontWeight:800, color:T.text, fontFamily:SANS }}>Hôte ESXi</div>
          <div style={{ fontSize:11, color:T.blue, fontFamily:MONO }}>v{hostData.version}</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:28, flexWrap:"wrap", alignItems:"center", flex:1 }}>
        {[
          { label:"CPU",         value:`${cpuPct}%`,        sub:`${hostData.cpuUsage} / ${hostData.cpuMax} MHz`,              color:cpuColor },
          { label:"RAM",         value:`${memPct}%`,        sub:`${hostData.memUsage.toFixed(0)} / ${hostData.memMax.toFixed(0)} MB`, color:memColor },
          { label:"Processeurs", value:`${hostData.numCpu}`, sub:"cœurs logiques",                                            color:T.green  },
          { label:"Modèle",      value:hostData.cpuModel,   sub:null,                                                         color:T.textSub, truncate:true },
        ].map(({ label, value, sub, color, truncate }) => (
          <div key={label}>
            <div style={{ fontSize:10, color:T.textMuted, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:MONO, marginBottom:2 }}>{label}</div>
            <div style={{ fontSize:14, fontWeight:700, color, fontFamily:MONO, maxWidth:truncate?180:undefined, overflow:truncate?"hidden":undefined, textOverflow:truncate?"ellipsis":undefined, whiteSpace:truncate?"nowrap":undefined }}>{value}</div>
            {sub && <div style={{ fontSize:11, color:T.textMuted, fontFamily:MONO }}>{sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function DatastoreBar({ dsData }) {
  if (!dsData) return null;
  const used  = dsData.capacity - dsData.free;
  const pct   = dsData.capacity > 0 ? (used / dsData.capacity * 100).toFixed(0) : 0;
  const toGB  = b => (b / 1024 / 1024 / 1024).toFixed(1);
  const color = pct > 85 ? T.red : pct > 70 ? T.orange : T.green;
  const light = pct > 85 ? T.redLight : pct > 70 ? T.orangeLight : T.greenLight;
  return (
    <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"18px 24px", marginBottom:14, boxShadow:T.shadow }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:8, background:T.purpleLight, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2" strokeLinecap="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0018 0V5"/><path d="M3 12a9 3 0 0018 0"/>
            </svg>
          </div>
          <div>
            <span style={{ fontSize:14, fontWeight:700, color:T.text, fontFamily:SANS }}>Stockage</span>
            <span style={{ fontSize:11, color:T.textMuted, fontFamily:MONO, marginLeft:8 }}>{dsData.name}</span>
          </div>
        </div>
        <span style={{ fontSize:13, fontWeight:700, color, padding:"5px 14px", borderRadius:8, background:light, fontFamily:MONO }}>
          {toGB(used)} / {toGB(dsData.capacity)} Go · {pct}%
        </span>
      </div>
      <div style={{ height:6, background:T.border, borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:3, transition:"width 1s ease" }}/>
      </div>
      <div style={{ display:"flex", gap:20, marginTop:8 }}>
        {[`Libre : ${toGB(dsData.free)} Go`, `Provisionné : ${toGB(dsData.provisioned)} Go`, `Machines virtuelles : ${dsData.vms}`].map(t => (
          <span key={t} style={{ fontSize:11, color:T.textMuted, fontFamily:MONO }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function AlertPanel({ signozAlerts, logs, errorCounts, loadingAlerts }) {
  const active   = signozAlerts.filter(a => !a.resolved);
  const resolved = signozAlerts.filter(a =>  a.resolved);
  const logColor = line => {
    const l = line.toLowerCase();
    if (l.includes("failed") || l.includes("error")) return T.red;
    if (l.includes("warn")   || l.includes("timeout")) return T.orange;
    if (l.includes("info")) return T.blue;
    return T.textSub;
  };
  const formatTs = ns => new Date(ns / 1e6).toLocaleTimeString("fr-FR");
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"20px 22px", boxShadow:T.shadow }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:30, height:30, borderRadius:8, background:T.redLight, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2.2" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:T.text, fontFamily:SANS }}>Alertes système</div>
              <div style={{ fontSize:11, color:T.textMuted, fontFamily:MONO }}>Vue d'ensemble</div>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {[
              { c:active.length,   color:T.red,   light:T.redLight,   l:"ACTIVES"  },
              { c:resolved.length, color:T.green, light:T.greenLight, l:"RÉSOLUES" },
            ].map(({ c, color, light, l }) => (
              <div key={l} style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"10px 18px", borderRadius:10, background:light }}>
                <span style={{ fontSize:26, fontWeight:900, color, fontFamily:MONO, lineHeight:1 }}>{c}</span>
                <span style={{ fontSize:9, color, fontFamily:MONO, letterSpacing:"0.1em", marginTop:4 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
          {[
            { label:"Timeouts (5m)",   count:errorCounts.timeout,    color:T.orange, light:T.orangeLight },
            { label:"Erreurs disque",  count:errorCounts.disk,       color:T.red,    light:T.redLight    },
            { label:"Scoreboard VM",   count:errorCounts.scoreboard, color:T.purple, light:T.purpleLight },
            { label:"Connexions root", count:errorCounts.login,      color:T.cyan,   light:T.cyanLight   },
          ].map(({ label, count, color, light }) => (
            <div key={label} style={{ padding:"12px 14px", borderRadius:10, background:light, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize:11, color, fontFamily:MONO, fontWeight:600 }}>{label}</span>
              <span style={{ fontSize:22, fontWeight:900, color, fontFamily:MONO }}>{count}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:14, padding:"20px 22px", boxShadow:T.shadow }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
          <div style={{ width:30, height:30, borderRadius:8, background:T.blueLight, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2.2" strokeLinecap="round">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:T.text, fontFamily:SANS }}>Journaux en direct</div>
            <div style={{ fontSize:11, color:T.textMuted, fontFamily:MONO }}>10 dernières minutes</div>
          </div>
          <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:T.green, animation:"blink 2s infinite" }}/>
            <span style={{ fontSize:11, color:T.green, fontFamily:MONO, fontWeight:600 }}>LIVE</span>
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:4, maxHeight:320, overflowY:"auto" }}>
          {logs.length === 0 ? (
            <div style={{ textAlign:"center", padding:32, color:T.textMuted, fontSize:13, fontFamily:MONO }}>Aucun journal récent…</div>
          ) : logs.map((entry, i) => (
            <div key={i} style={{ padding:"8px 10px", borderRadius:7, background:T.surfaceAlt, border:`1px solid rgba(0,0,0,0.05)`, borderLeft:`3px solid ${logColor(entry.line)}`, animation:`fadeUp 0.3s ease both`, animationDelay:`${i*0.03}s` }}>
              <div style={{ display:"flex", gap:8, alignItems:"baseline" }}>
                <span style={{ fontSize:10, color:T.textMuted, fontFamily:MONO, flexShrink:0 }}>{formatTs(entry.ts)}</span>
                <span style={{ fontSize:11, color:logColor(entry.line), fontFamily:MONO, lineHeight:1.5, wordBreak:"break-all" }}>
                  {entry.line.substring(0, 120)}{entry.line.length > 120 ? "…" : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── HostCpuChart ─────────────────────────────────────────────────────────────
// FIX : useEffect dépend de [pct] et récupère le vrai historique via query_range
// ─── HostCpuChart ─────────────────────────────────────────────────────────────
// Calcul exact ESXi : vmware_host_cpu_usage (MHz) / vmware_host_cpu_max (MHz) × 100
// Axe Y fixé 0–100 %. Historique réel via query_range Prometheus (30 min, pas 30s).
function HostCpuChart({ cpuUsage, cpuMax }) {
  const canvasRef  = useRef(null);
  const chartRef   = useRef(null);

  // ── Calcul exact du % courant ──────────────────────────────────────────────
  // Identique au calcul ESXi natif : usage_MHz / max_MHz × 100
  const pctNow = cpuMax > 0 ? (cpuUsage / cpuMax) * 100 : 0;
  // Couleur dynamique selon charge
  const pctColor = pctNow >= 85 ? T.red : pctNow >= 60 ? T.orange : T.blue;

  useEffect(() => {
    if (!canvasRef.current || cpuMax === 0) return;

    let destroyed = false;

    async function buildChart() {
      const endTs   = Math.floor(Date.now() / 1000);
      const startTs = endTs - 30 * 60; // 30 minutes d'historique
      const step    = 30;              // granularité 30 secondes

      let labels    = [];
      let dataUsage = []; // % exact  = usage_MHz / max_MHz × 100

      try {
        // ── 1. Récupère l'historique usage (MHz) sur 30 min ──────────────────
        const urlUsage = `${PROM_RANGE}?query=${encodeURIComponent("vmware_host_cpu_usage")}&start=${startTs}&end=${endTs}&step=${step}`;
        // ── 2. Récupère l'historique max (MHz) sur 30 min ────────────────────
        const urlMax   = `${PROM_RANGE}?query=${encodeURIComponent("vmware_host_cpu_max")}&start=${startTs}&end=${endTs}&step=${step}`;

        const [resUsage, resMax] = await Promise.all([fetch(urlUsage), fetch(urlMax)]);
        const [jsonUsage, jsonMax] = await Promise.all([resUsage.json(), resMax.json()]);

        const valsUsage = jsonUsage?.data?.result?.[0]?.values || [];
        const valsMax   = jsonMax?.data?.result?.[0]?.values   || [];

        // Construit un map ts → max_MHz pour aligner les deux séries
        const maxMap = {};
        valsMax.forEach(([ts, val]) => { maxMap[ts] = parseFloat(val); });

        if (valsUsage.length > 0) {
          valsUsage.forEach(([ts, usageVal]) => {
            const usageMHz = parseFloat(usageVal);
            // Utilise le max du même instant si dispo, sinon cpuMax passé en prop
            const maxMHz   = maxMap[ts] ?? cpuMax;
            // ── Calcul exact % CPU ESXi ──────────────────────────────────────
            const pct = maxMHz > 0 ? Math.min((usageMHz / maxMHz) * 100, 100) : 0;

            const d = new Date(parseInt(ts) * 1000);
            labels.push(d.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit", second:"2-digit" }));
            dataUsage.push(parseFloat(pct.toFixed(2)));
          });
        }
      } catch {}

      // ── Fallback : si Prometheus inaccessible, on trace un point unique ──
      if (dataUsage.length === 0) {
        labels    = ["maintenant"];
        dataUsage = [parseFloat(pctNow.toFixed(2))];
      }

      import("chart.js/auto").then(({ default: Chart }) => {
        if (destroyed) return;
        if (chartRef.current) chartRef.current.destroy();

        chartRef.current = new Chart(canvasRef.current, {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "CPU ESXi %",
                data: dataUsage,
                borderColor: pctColor,
                backgroundColor: pctNow >= 85
                  ? "rgba(220,38,38,0.08)"
                  : pctNow >= 60
                  ? "rgba(234,88,12,0.08)"
                  : "rgba(37,99,235,0.08)",
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: pctColor,
                fill: true,
                tension: 0.35,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            animation: { duration: 400 },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: "#fff",
                borderColor: T.border,
                borderWidth: 1,
                titleColor: T.text,
                bodyColor: T.textSub,
                titleFont: { family: MONO, size: 11 },
                bodyFont:  { family: MONO, size: 11 },
                padding: 10,
                callbacks: {
                  title: items => items[0].label,
                  label: ctx => {
                    const pctVal = ctx.parsed.y;
                    const mhzVal = cpuMax > 0 ? ((pctVal / 100) * cpuMax).toFixed(0) : "—";
                    return `  CPU : ${pctVal.toFixed(2)}%  (${mhzVal} MHz / ${cpuMax} MHz)`;
                  },
                },
              },
            },
            scales: {
              x: {
                grid:   { color: "rgba(0,0,0,0.04)" },
                border: { display: false },
                ticks:  { font: { family: MONO, size: 10 }, color: T.textMuted, maxTicksLimit: 8, maxRotation: 0 },
              },
              y: {
                // ── Axe Y fixé 0–100 % ──────────────────────────────────────
                min: 0,
                max: 100,
                grid:   { color: "rgba(0,0,0,0.04)" },
                border: { display: false },
                ticks: {
                  font: { family: MONO, size: 10 },
                  color: T.textMuted,
                  stepSize: 10,
                  callback: v => v + "%",
                },
              },
            },
          },
        });
      }).catch(() => {});
    }

    buildChart();
    return () => {
      destroyed = true;
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  // Se redessine à chaque nouvelle valeur cpuUsage / cpuMax reçue du parent
  }, [cpuUsage, cpuMax]);

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 14, boxShadow: T.shadow }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: pctNow >= 85 ? T.redLight : pctNow >= 60 ? T.orangeLight : T.blueLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={pctColor} strokeWidth="2" strokeLinecap="round">
              <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/>
              <line x1="9"  y1="1"  x2="9"  y2="4" /><line x1="15" y1="1"  x2="15" y2="4" />
              <line x1="9"  y1="20" x2="9"  y2="23"/><line x1="15" y1="20" x2="15" y2="23"/>
              <line x1="20" y1="9"  x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14"/>
              <line x1="1"  y1="9"  x2="4"  y2="9" /><line x1="1"  y1="14" x2="4"  y2="14"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: T.text, fontFamily: SANS }}>CPU Hyperviseur — Activité en temps réel</div>
            <div style={{ fontSize: 11, color: T.textMuted, fontFamily: MONO, marginTop: 2 }}>
              {cpuUsage.toFixed(0)} MHz utilisé · {cpuMax.toFixed(0)} MHz max · calcul exact ESXi
            </div>
          </div>
        </div>

        {/* ── Valeur courante + barre de progression compacte ── */}
        <div style={{ textAlign: "right", minWidth: 120 }}>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: MONO, color: pctColor, lineHeight: 1 }}>
            {pctNow.toFixed(1)}%
          </div>
          <div style={{ fontSize: 10, color: T.textMuted, fontFamily: MONO, marginTop: 3 }}>utilisation actuelle</div>
          {/* mini barre 0-100 */}
          <div style={{ marginTop: 6, height: 4, width: 120, background: T.border, borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(pctNow, 100)}%`, background: pctColor, borderRadius: 2, transition: "width 0.8s ease" }}/>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
            <span style={{ fontSize: 9, color: T.textMuted, fontFamily: MONO }}>0%</span>
            <span style={{ fontSize: 9, color: T.textMuted, fontFamily: MONO }}>100%</span>
          </div>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div style={{ position: "relative", height: 240 }}>
        <canvas ref={canvasRef}/>
      </div>

      {/* ── Légende bas ── */}
      <div style={{ display: "flex", gap: 20, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.border}` }}>
        {[
          { color: pctColor, label: "CPU ESXi %", sub: `vmware_host_cpu_usage / vmware_host_cpu_max × 100` },
        ].map(({ color, label, sub }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 24, height: 3, background: color, borderRadius: 2 }}/>
            <div>
              <span style={{ fontSize: 11, fontWeight: 700, color: T.text, fontFamily: MONO }}>{label}</span>
              <span style={{ fontSize: 10, color: T.textMuted, fontFamily: MONO, marginLeft: 8 }}>{sub}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VmCard({ vm, isOpen, onToggle, index }) {
  const [memData, setMemData] = useState({ consumedKB:null, totalMB:null });
  const isOnline = vm.powerState === "Online";
  const ac = isOnline ? T.green : T.red;
  const al = isOnline ? T.greenLight : T.redLight;
  const ab = isOnline ? T.greenBorder : T.redBorder;
  useEffect(() => {
    async function go() {
      try {
        const [r1,r2] = await Promise.all([
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_mem_consumed_average{vm_name="${vm.name}"}`)}`),
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_memory_max{vm_name="${vm.name}"}`)}`),
        ]);
        const [d1,d2] = await Promise.all([r1.json(),r2.json()]);
        setMemData({
          consumedKB: d1?.data?.result?.[0]?.value?.[1] ? parseFloat(d1.data.result[0].value[1]) : null,
          totalMB:    d2?.data?.result?.[0]?.value?.[1] ? parseFloat(d2.data.result[0].value[1]) : null,
        });
      } catch {}
    }
    go();
    const id = setInterval(go, 10000);
    return () => clearInterval(id);
  }, [vm.name]);
  return (
    <div style={{
      background:T.surface, border:`1px solid ${isOpen ? T.blue : T.border}`,
      borderLeft:`3px solid ${ac}`, borderRadius:14, overflow:"hidden",
      animation:`fadeUp 0.4s ease both`, animationDelay:`${index*0.06}s`,
      transition:"all 0.2s", boxShadow:isOpen?`0 6px 24px rgba(37,99,235,0.10)`:T.shadow,
    }}
    onMouseEnter={e => { if(!isOpen){ e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow=T.shadowMd; }}}
    onMouseLeave={e => { if(!isOpen){ e.currentTarget.style.transform="translateY(0)";    e.currentTarget.style.boxShadow=T.shadow;   }}}>
      <div onClick={onToggle} style={{ padding:"18px 22px", cursor:"pointer", userSelect:"none" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{ width:44, height:44, borderRadius:10, background:al, border:`1px solid ${ab}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ac} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
              <circle cx="6" cy="6" r="1.2" fill={ac} stroke="none"/><circle cx="6" cy="18" r="1.2" fill={ac} stroke="none"/>
            </svg>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:800, color:T.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", fontFamily:MONO }}>{vm.name}</div>
            <div style={{ fontSize:12, color:T.textMuted, marginTop:2, fontFamily:SANS }}>{vm.tenant} · {vm.numCpu} cœurs · {vm.memTotalMB} Mo RAM</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <StatusBadge state={vm.powerState}/>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2.5" strokeLinecap="round" style={{ transform:isOpen?"rotate(180deg)":"rotate(0)", transition:"transform 0.3s" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>
        <div style={{ marginTop:14, padding:"12px 16px", background:T.surfaceAlt, borderRadius:8, border:`1px solid ${T.border}` }}>
          <MemoryBar consumedKB={memData.consumedKB} totalMB={memData.totalMB}/>
        </div>
      </div>
      <div style={{ maxHeight:isOpen?"6000px":"0", overflow:"hidden", transition:"max-height 0.6s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ borderTop:`1px solid ${T.border}`, padding:"4px 22px 28px", background:T.surfaceAlt }}>
          <SectionLabel>Processeur</SectionLabel>
          <GraphBox tall><CpuGraph vmName={vm.name}/></GraphBox>
          <SectionLabel>Stockage</SectionLabel>
          <GraphBox><DiskUsage vmName={vm.name}/></GraphBox>
          <SectionLabel>Alimentation</SectionLabel>
          <GraphBox><PowerStatus vmName={vm.name}/></GraphBox>
          <SectionLabel>Réseau</SectionLabel>
          <GraphBox><NetworkGraph vmName={vm.name}/></GraphBox>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [vms,           setVms]           = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [openVm,        setOpenVm]        = useState(null);
  const [lastUpdated,   setLastUpdated]   = useState(null);
  const [tick,          setTick]          = useState(30);
  const [hostData,      setHostData]      = useState(null);
  const [dsData,        setDsData]        = useState(null);
  const [signozAlerts,  setSignozAlerts]  = useState([]);
  const [logs,          setLogs]          = useState([]);
  const [errorCounts,   setErrorCounts]   = useState({ timeout:0, disk:0, scoreboard:0, login:0 });
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [veeamData,     setVeeamData]     = useState(undefined);

  const fetchVeeam = useCallback(async () => {
    const data = await fetchVeeamJob();
    setVeeamData(data);
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    const [sa, l, ec] = await Promise.all([
      fetchSigNozAlerts(),
      fetchRecentLogs(10),
      Promise.all([
        fetchErrorCount('{job="esxi"} |= "timed out"'),
        fetchErrorCount('{job="esxi"} |= "nmp_ThrottleLogForDevice"'),
        fetchErrorCount('{job="esxi"} |= "scoreboard is not readable"'),
        fetchErrorCount('{job="esxi"} |= "Accepted password for user root"'),
      ]),
    ]);
    if (sa !== null) setSignozAlerts(sa);
    setLogs(l);
    setErrorCounts({ timeout:ec[0], disk:ec[1], scoreboard:ec[2], login:ec[3] });
    setLoadingAlerts(false);
  }, []);

  const fetchVMs = useCallback(async () => {
    try {
      const [cpuR, pwrR] = await Promise.all([pq("vmware_vm_cpu_usage_average"), pq("vmware_vm_power_state")]);
      const pwrMap = {};
      pwrR.forEach(r => { pwrMap[r.metric.vm_name] = r.value[1]==="1"?"Online":"Offline"; });
      const names = [...new Set([...cpuR.map(r=>r.metric.vm_name), ...pwrR.map(r=>r.metric.vm_name)])];
      const vmList = await Promise.all(names.map(async name => {
        const cpuItem = cpuR.find(r=>r.metric.vm_name===name);
        const tenant  = cpuItem?.metric?.dc_name || "VMware ESXi";
        const [cR,mR,nR] = await Promise.all([
          pq(`vmware_vm_mem_consumed_average{vm_name="${name}"}`),
          pq(`vmware_vm_memory_max{vm_name="${name}"}`),
          pq(`vmware_vm_num_cpu{vm_name="${name}"}`),
        ]);
        const consumedKB = firstVal(cR);
        const totalMB    = firstVal(mR);
        const numCpu     = firstVal(nR,0);
        const totalKB    = totalMB * 1024;
        const memPct     = totalKB > 0 ? Math.min((consumedKB/totalKB)*100,100).toFixed(1) : "N/A";
        return { name, tenant, powerState:pwrMap[name]??"Unknown", memoryUsage:memPct, memoryConsumedMB:consumedKB/1024, memoryTotalMB:totalMB, numCpu, memTotalMB:totalMB };
      }));
      vmList.sort((a,b) => {
        if (a.powerState!==b.powerState) { if(a.powerState==="Online")return -1; if(b.powerState==="Online")return 1; if(a.powerState==="Offline")return -1; return 1; }
        return a.name.localeCompare(b.name);
      });
      setVms(vmList);
      const [hCU,hCM,hMU,hMM,hNC,hProd,hHW] = await Promise.all([
        pq("vmware_host_cpu_usage"),pq("vmware_host_cpu_max"),
        pq("vmware_host_memory_usage"),pq("vmware_host_memory_max"),
        pq("vmware_host_num_cpu"),pq("vmware_host_product_info"),pq("vmware_host_hardware_info"),
      ]);
      setHostData({ cpuUsage:firstVal(hCU), cpuMax:firstVal(hCM), memUsage:firstVal(hMU), memMax:firstVal(hMM), numCpu:firstVal(hNC), version:hProd[0]?.metric?.version||"—", cpuModel:hHW[0]?.metric?.hardware_cpu_model||"—" });
      const [dC,dF,dP,dV] = await Promise.all([pq("vmware_datastore_capacity_size"),pq("vmware_datastore_freespace_size"),pq("vmware_datastore_provisoned_size"),pq("vmware_datastore_vms")]);
      if (dC.length) setDsData({ name:dC[0]?.metric?.ds_name||"datastore1", capacity:firstVal(dC), free:firstVal(dF), provisioned:firstVal(dP), vms:firstVal(dV) });
      setLastUpdated(new Date());
      setError(null);
      setTick(30);
    } catch { setError("Impossible de joindre le serveur de métriques."); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchVMs(); fetchAlerts(); fetchVeeam();
    const di = setInterval(fetchVMs,    30000);
    const ai = setInterval(fetchAlerts, 15000);
    const vi = setInterval(fetchVeeam,  10000);
    const ti = setInterval(() => setTick(t => t<=0?30:t-1), 1000);
    return () => { clearInterval(di); clearInterval(ai); clearInterval(vi); clearInterval(ti); };
  }, [fetchVMs, fetchAlerts, fetchVeeam]);

  const online       = vms.filter(v => v.powerState === "Online").length;
  const offline      = vms.filter(v => v.powerState === "Offline").length;
  const uptime       = vms.length > 0 ? `${((online / vms.length) * 100).toFixed(0)}%` : "—";
  const totalErrors  = errorCounts.timeout + errorCounts.disk + errorCounts.scoreboard;
  const activeAlerts = signozAlerts.filter(a => !a.resolved);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        @keyframes blink   {0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.6)}}
        @keyframes fadeUp  {from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin    {to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.12);border-radius:4px}
      `}</style>

      <div style={{ minHeight:"100vh", background:T.bg, fontFamily:SANS, color:T.text }}>

        {/* ── Header ── */}
        <div style={{
          padding:"0 36px", display:"flex", alignItems:"center", justifyContent:"space-between",
          height:64, borderBottom:`1px solid ${T.border}`, background:T.surface,
          boxShadow:"0 1px 0 rgba(0,0,0,0.05)", position:"sticky", top:0, zIndex:200,
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:T.blueLight, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:18, fontWeight:900, color:T.text, letterSpacing:"-0.03em", fontFamily:SANS }}>Infrastructure</div>
              <div style={{ fontSize:11, color:T.textMuted, fontFamily:MONO, marginTop:1 }}>VMware ESXi · Tableau de bord</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {lastUpdated && (
              <span style={{ fontSize:11, color:T.textMuted, fontFamily:MONO }}>Mis à jour {lastUpdated.toLocaleTimeString("fr-FR")}</span>
            )}
            {totalErrors > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:8, background:T.redLight, border:`1px solid ${T.redBorder}` }}>
                <span style={{ width:5, height:5, borderRadius:"50%", background:T.red, animation:"blink 2s infinite", display:"block" }}/>
                <span style={{ fontSize:11, fontWeight:700, color:T.red, fontFamily:MONO }}>{totalErrors} erreur{totalErrors>1?"s":""}</span>
              </div>
            )}
            <div style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px", borderRadius:8, background:tick<=5?T.orangeLight:T.blueLight, border:`1px solid ${tick<=5?T.orangeBorder:T.blueBorder}` }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={tick<=5?T.orange:T.blue} strokeWidth="2.5" strokeLinecap="round" style={{ animation:"spin 2s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <span style={{ fontSize:11, fontWeight:700, color:tick<=5?T.orange:T.blue, fontFamily:MONO }}>{tick}s</span>
            </div>
            <NotificationBar alerts={signozAlerts}/>
            <button onClick={() => { fetchVMs(); fetchAlerts(); fetchVeeam(); }} style={{
              width:36, height:36, borderRadius:9, border:`1px solid ${T.border}`,
              background:T.surface, cursor:"pointer", display:"flex", alignItems:"center",
              justifyContent:"center", transition:"all 0.15s", boxShadow:T.shadow,
            }}
            onMouseEnter={e => e.currentTarget.style.background=T.surfaceAlt}
            onMouseLeave={e => e.currentTarget.style.background=T.surface}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textSub} strokeWidth="2.2" strokeLinecap="round">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ padding:"24px 36px", maxWidth:1440, margin:"0 auto" }}>
          <HostInfoBar hostData={hostData}/>
          <DatastoreBar dsData={dsData}/>

          {hostData && <HostCpuChart cpuUsage={hostData.cpuUsage} cpuMax={hostData.cpuMax}/>}

          
          <VeeamBackupCard data={veeamData}/>

          <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:14 }}>
            <StatCard label="En ligne" value={online} bgColor={T.greenLight} accent={T.green} sub={`${uptime} de disponibilité`}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>}/>
            <StatCard label="Hors ligne" value={offline} bgColor={T.redLight} accent={T.red}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>}/>
            <StatCard label="Total" value={vms.length} bgColor={T.purpleLight} accent={T.purple} sub="machines virtuelles"
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg>}/>
            <StatCard label="Alertes actives" value={activeAlerts.length} bgColor={activeAlerts.length>0?T.redLight:T.greenLight} accent={activeAlerts.length>0?T.red:T.green}
              sub={activeAlerts.length>0?"Voir les notifications":"Système opérationnel"}
              icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={activeAlerts.length>0?T.red:T.green} strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>}/>
          </div>

          <AlertPanel signozAlerts={signozAlerts} logs={logs} errorCounts={errorCounts} loadingAlerts={loadingAlerts}/>

          {vms.length > 0 && (
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
              {vms.map(vm => {
                const isActive = openVm === vm.name;
                const dot = vm.powerState==="Online"?T.green:vm.powerState==="Offline"?T.red:T.yellow;
                return (
                  <div key={vm.name} onClick={() => setOpenVm(openVm===vm.name?null:vm.name)}
                    style={{ padding:"7px 14px", borderRadius:8, cursor:"pointer", transition:"all 0.12s",
                      background:isActive?T.blueLight:T.surface, border:`1px solid ${isActive?T.blueBorder:T.border}`,
                      display:"flex", alignItems:"center", gap:6, boxShadow:isActive?"none":T.shadow }}
                    onMouseEnter={e => { if(!isActive) e.currentTarget.style.background=T.surfaceAlt; }}
                    onMouseLeave={e => { if(!isActive) e.currentTarget.style.background=T.surface;    }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:dot, animation:vm.powerState==="Online"?"blink 2.5s ease-in-out infinite":"none" }}/>
                    <span style={{ fontSize:12, fontWeight:600, color:isActive?T.blue:T.textSub, fontFamily:MONO }}>{vm.name}</span>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div style={{ padding:"12px 16px", borderRadius:10, background:T.redLight, border:`1px solid ${T.redBorder}`, color:T.red, fontSize:13, marginBottom:14, display:"flex", alignItems:"center", gap:10 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {error}
            </div>
          )}
          {loading && (
            <div style={{ textAlign:"center", padding:56, color:T.textMuted, fontSize:13, fontFamily:MONO }}>Connexion en cours…</div>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {vms.map((vm, idx) => (
              <VmCard key={vm.name} vm={vm} index={idx} isOpen={openVm===vm.name} onToggle={() => setOpenVm(openVm===vm.name?null:vm.name)}/>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
