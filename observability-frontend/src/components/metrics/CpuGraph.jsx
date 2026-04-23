import { useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

// ─── Prometheus range endpoint ────────────────────────────────────────────────
const PROM = "http://prometheus.local/api/v1/query_range";

const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const SANS = "'DM Sans', system-ui, sans-serif";

const T = {
  surface:      "#ffffff",
  surfaceAlt:   "#f7f9fc",
  border:       "rgba(0,0,0,0.07)",
  text:         "#0f172a",
  textMuted:    "#94a3b8",
  blue:         "#2563eb",
  blueLight:    "#eff6ff",
  green:        "#16a34a",
  greenLight:   "#f0fdf4",
  greenBorder:  "#bbf7d0",
  orange:       "#ea580c",
  orangeLight:  "#fff7ed",
  orangeBorder: "#fed7aa",
  red:          "#dc2626",
  redLight:     "#fef2f2",
  redBorder:    "#fecaca",
  shadow:       "0 1px 3px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.04)",
};

// ─── Helpers couleur ──────────────────────────────────────────────────────────
function pctColor(v) {
  if (v === null) return T.textMuted;
  if (v > 80)    return T.red;
  if (v > 50)    return T.orange;
  return T.green;
}
function pctBg(v) {
  if (v === null) return T.surfaceAlt;
  if (v > 80)    return T.redLight;
  if (v > 50)    return T.orangeLight;
  return T.greenLight;
}
function pctBorder(v) {
  if (v === null) return T.border;
  if (v > 80)    return T.redBorder;
  if (v > 50)    return T.orangeBorder;
  return T.greenBorder;
}

// ─── Plugin Chart.js : zones colorées + lignes de seuil ──────────────────────
const thresholdPlugin = {
  id: "thresholdZones",
  beforeDatasetsDraw(chart) {
    const { ctx, chartArea, scales: { y } } = chart;
    if (!y || !chartArea) return;
    const { left, right, top, bottom } = chartArea;

    // Zones de fond colorées
    const zones = [
      { from: 0,  to: 50,  color: "rgba(22,163,74,0.035)"  },
      { from: 50, to: 80,  color: "rgba(234,88,12,0.055)"  },
      { from: 80, to: 100, color: "rgba(220,38,38,0.07)"   },
    ];

    zones.forEach(({ from, to, color }) => {
      const yTop = Math.max(y.getPixelForValue(to),   top);
      const yBot = Math.min(y.getPixelForValue(from), bottom);
      if (yBot <= yTop) return;
      ctx.save();
      ctx.fillStyle = color;
      ctx.fillRect(left, yTop, right - left, yBot - yTop);
      ctx.restore();
    });

    // Lignes de seuil pointillées
    [
      { val: 50, color: "rgba(234,88,12,0.35)" },
      { val: 80, color: "rgba(220,38,38,0.40)" },
    ].forEach(({ val, color }) => {
      const py = y.getPixelForValue(val);
      if (py < top || py > bottom) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(left, py);
      ctx.lineTo(right, py);
      ctx.stroke();
      ctx.restore();
    });
  },
};

// ─── Badge statistique ────────────────────────────────────────────────────────
function StatBadge({ label, value }) {
  const color  = pctColor(value);
  const bg     = pctBg(value);
  const border = pctBorder(value);
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "12px 22px", borderRadius: 12,
      background: bg, border: `1px solid ${border}`,
      minWidth: 90,
    }}>
      <span style={{ fontSize: 30, fontWeight: 900, color, fontFamily: MONO, lineHeight: 1 }}>
        {value === null ? "—" : value.toFixed(1)}
        <span style={{ fontSize: 15, fontWeight: 700 }}>%</span>
      </span>
      <span style={{
        fontSize: 9, color, fontFamily: MONO,
        letterSpacing: "0.12em", marginTop: 6, textTransform: "uppercase",
      }}>
        {label}
      </span>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function CpuGraph({ vmName }) {
  const [chartData, setChartData] = useState(null);
  const [current,   setCurrent]   = useState(null);
  const [avgVal,    setAvgVal]    = useState(null);
  const [maxVal,    setMaxVal]    = useState(null);
  const [usedMHz,   setUsedMHz]   = useState(null);
  const [capMHz,    setCapMHz]    = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);

  useEffect(() => {
    async function fetchData() {
      setError(false);
      try {
        const end   = Math.floor(Date.now() / 1000);
        const start = end - 3600;
        const step  = 30;
        const encQ  = q => encodeURIComponent(q);

        // ── Formule identique à vCenter / vmware_exporter ────────────────────
        //   CPU % = (vmware_vm_cpu_usage_average ÷ vmware_vm_max_cpu_usage) × 100
        //   usage_average  = MHz consommés  (moyenne sur l'intervalle de scrape)
        //   max_cpu_usage  = MHz alloués    (num_vcpu × fréquence cœur hôte)
        // ─────────────────────────────────────────────────────────────────────
        const queryUsage = `vmware_vm_cpu_usage_average{vm_name="${vmName}"}`;
        const queryMax   = `vmware_vm_max_cpu_usage{vm_name="${vmName}"}`;

        const [resUsage, resMax] = await Promise.all([
          fetch(`${PROM}?query=${encQ(queryUsage)}&start=${start}&end=${end}&step=${step}`),
          fetch(`${PROM}?query=${encQ(queryMax)}&start=${start}&end=${end}&step=${step}`),
        ]);
        const [jUsage, jMax] = await Promise.all([resUsage.json(), resMax.json()]);

        const usageValues = jUsage?.data?.result?.[0]?.values ?? [];
        const maxValues   = jMax?.data?.result?.[0]?.values   ?? [];

        if (!usageValues.length) { setLoading(false); return; }

        const maxMap = new Map(maxValues.map(([ts, v]) => [ts, parseFloat(v)]));

        const points = usageValues.map(([ts, rawUsage]) => {
          const usageMHz = parseFloat(rawUsage);
          const capMHzPt = maxMap.get(ts) ?? null;
          const pct      = capMHzPt && capMHzPt > 0
            ? Math.min((usageMHz / capMHzPt) * 100, 100)
            : null;
          return { ts: parseInt(ts), usageMHz, capMHzPt, pct };
        });

        const lastPt = [...points].reverse().find(p => p.pct !== null);
        if (lastPt) {
          setCurrent(parseFloat(lastPt.pct.toFixed(1)));
          setUsedMHz(lastPt.usageMHz.toFixed(0));
          setCapMHz(lastPt.capMHzPt?.toFixed(0) ?? null);
        }

        const validPcts = points.map(p => p.pct).filter(v => v !== null);
        if (validPcts.length) {
          setAvgVal(parseFloat((validPcts.reduce((a, b) => a + b, 0) / validPcts.length).toFixed(1)));
          setMaxVal(parseFloat(Math.max(...validPcts).toFixed(1)));
        }

        const labels = points.map(({ ts }) =>
          new Date(ts * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        );

        setChartData({
          labels,
          datasets: [{
            label: "CPU %",
            data: points.map(p => p.pct),
            borderColor: T.blue,
            backgroundColor: "rgba(37,99,235,0.08)",
            borderWidth: 2.5,
            tension: 0.38,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBackgroundColor: T.blue,
            pointHoverBorderColor: "#fff",
            pointHoverBorderWidth: 2,
            spanGaps: true,
          }],
        });
      } catch (e) {
        console.error("CpuGraph error:", e);
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [vmName]);

  // ─── Options Chart.js ─────────────────────────────────────────────────────
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: "easeInOutQuart" },
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { display: false },
      thresholdZones: {},
      tooltip: {
        backgroundColor: "#fff",
        borderColor: "rgba(0,0,0,0.10)",
        borderWidth: 1,
        titleColor: T.textMuted,
        bodyColor: T.text,
        padding: 14,
        titleFont: { family: MONO, size: 10 },
        bodyFont:  { family: MONO, size: 13, weight: "700" },
        callbacks: {
          title:       items => items[0]?.label ?? "",
          label:       ctx => {
            const v = ctx.parsed.y;
            return v !== null ? `  CPU : ${v.toFixed(2)} %` : "  Pas de données";
          },
          afterLabel:  ctx => {
            const v = ctx.parsed.y;
            if (v === null) return "";
            if (v > 80) return "  ⚠ Utilisation critique";
            if (v > 50) return "  ▲ Utilisation élevée";
            return "  ✓ Utilisation normale";
          },
        },
      },
    },
    scales: {
      x: {
        grid:   { color: "rgba(0,0,0,0.04)", drawBorder: false },
        ticks:  { font: { family: MONO, size: 10 }, color: T.textMuted, maxTicksLimit: 10, maxRotation: 0 },
        border: { display: false },
      },
      y: {
        beginAtZero: true,
        min: 0,
        max: 100,          // ← FIXÉ à 100 % — cohérent avec vCenter
        grid:   { color: "rgba(0,0,0,0.05)", drawBorder: false },
        ticks:  {
          font:     { family: MONO, size: 10 },
          color:    T.textMuted,
          callback: v => `${v} %`,
          stepSize: 10,    // graduations : 0, 10, 20 … 100
        },
        border: { display: false },
      },
    },
  };

  const curColor = pctColor(current);

  return (
    <div>
      {/* ── En-tête ───────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 20, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.text, fontFamily: SANS, letterSpacing: "-0.01em" }}>
            Utilisation du processeur
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, fontFamily: MONO, marginTop: 4 }}>
            {loading
              ? "Récupération des métriques…"
              : usedMHz && capMHz
                ? `${usedMHz} MHz utilisé · ${capMHz} MHz capacité · fenêtre 1 h`
                : "Fenêtre 1 heure · pas 30 s"}
          </div>
          {/* Formule de calcul — discrète et professionnelle */}
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 24, height: 2.5, borderRadius: 2, background: T.blue, display: "inline-block" }}/>
            <span style={{ fontSize: 10, color: T.textMuted, fontFamily: MONO }}>
              CPU (%) = usage_MHz ÷ max_MHz × 100
            </span>
          </div>
        </div>

        {/* Badges */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatBadge label="Actuel" value={loading ? null : current} />
          <StatBadge label="Moy 1h" value={loading ? null : avgVal}  />
          <StatBadge label="Max 1h" value={loading ? null : maxVal}  />
        </div>
      </div>

      {/* ── Graphique ─────────────────────────────────────────────────────── */}
      <div style={{
        position: "relative",
        height: 300,              // ← 300 px (était 220 px)
        borderRadius: 12,
        overflow: "hidden",
        background: T.surfaceAlt,
        border: `1px solid ${T.border}`,
        padding: "14px 8px 6px",
        boxShadow: T.shadow,
      }}>
        {loading ? (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, color: T.textMuted, fontFamily: MONO, gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={T.blue} strokeWidth="2.2" strokeLinecap="round"
              style={{ animation: "spin 1.2s linear infinite" }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Récupération des métriques…
          </div>
        ) : error ? (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, color: T.red, fontFamily: MONO,
          }}>
            ✕ Erreur lors du chargement
          </div>
        ) : !chartData ? (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, color: T.textMuted, fontFamily: MONO,
          }}>
            Aucune donnée disponible
          </div>
        ) : (
          <Line data={chartData} options={options} plugins={[thresholdPlugin]} />
        )}
      </div>

      {/* ── Légende des seuils + indicateur temps réel ────────────────────── */}
      <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        {[
          { label: "Normal  0 – 50 %",  dot: T.green,  zone: "rgba(22,163,74,0.12)"  },
          { label: "Élevé   50 – 80 %", dot: T.orange, zone: "rgba(234,88,12,0.12)"  },
          { label: "Critique > 80 %",   dot: T.red,    zone: "rgba(220,38,38,0.12)"  },
        ].map(({ label, dot, zone }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 12, height: 12, borderRadius: 3,
              background: zone, border: `1px solid ${dot}`, display: "inline-block",
            }}/>
            <span style={{ fontSize: 10, color: T.textMuted, fontFamily: MONO }}>{label}</span>
          </div>
        ))}

        {/* Indicateur temps réel discret */}
        {current !== null && (
          <div style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 8,
            background: pctBg(current), border: `1px solid ${pctBorder(current)}`,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: curColor, display: "inline-block",
              animation: "blink 2.5s ease-in-out infinite",
            }}/>
            <span style={{ fontSize: 11, fontWeight: 700, color: curColor, fontFamily: MONO }}>
              {current.toFixed(1)} % · temps réel
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

