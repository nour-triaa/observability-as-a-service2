import { useState, useEffect, useCallback } from "react";

// ─── Design tokens (light pro) ────────────────────────────────────────────────
const D = {
  bg:         "#f0f4f9",
  card:       "#ffffff",
  cardAlt:    "#f7f9fc",
  border:     "#dde4ef",
  borderMid:  "#c8d3e6",
  text:       "#0f1c2e",
  textSub:    "#4a607a",
  textMuted:  "#8fa4bc",
  // status
  online:     "#0a9e5c",
  onlineBg:   "rgba(10,158,92,0.08)",
  offline:    "#d63030",
  offlineBg:  "rgba(214,48,48,0.08)",
  // metrics
  cpu:        "#1a6ef4",  cpuBg:  "rgba(26,110,244,0.08)",
  mem:        "#7c3aed",  memBg:  "rgba(124,58,237,0.08)",
  disk:       "#059669",  diskBg: "rgba(5,150,105,0.08)",
  net:        "#0891b2",  netBg:  "rgba(8,145,178,0.08)",
  // thresholds
  warn:       "#d97706",  warnBg:   "rgba(217,119,6,0.08)",
  danger:     "#d63030",  dangerBg: "rgba(214,48,48,0.08)",
};

const MONO = "'JetBrains Mono', monospace";
const SANS = "'DM Sans', system-ui, sans-serif";

const PROM       = "http://prometheus.local/api/v1/query";
const PROM_RANGE = "http://prometheus.local/api/v1/query_range";

// ─── Prometheus helpers ───────────────────────────────────────────────────────
async function pq(query) {
  try {
    const res  = await fetch(`${PROM}?query=${encodeURIComponent(query)}`);
    const json = await res.json();
    return json.status === "success" ? json.data.result : [];
  } catch { return []; }
}

function firstVal(r, fb = 0) {
  return r[0] ? parseFloat(r[0].value[1]) : fb;
}

async function pqRange(query, minutes = 30) {
  try {
    const end   = Math.floor(Date.now() / 1000);
    const start = end - minutes * 60;
    const url   = `${PROM_RANGE}?query=${encodeURIComponent(query)}&start=${start}&end=${end}&step=60`;
    const res   = await fetch(url);
    const json  = await res.json();
    if (json.status !== "success") return [];
    return json.data.result[0]?.values?.map(([, v]) => parseFloat(v)) || [];
  } catch { return []; }
}

// ─── Threshold color ──────────────────────────────────────────────────────────
function tc(pct, base) {
  if (pct > 85) return D.danger;
  if (pct > 65) return D.warn;
  return base;
}

// ─── 270° Arc Gauge ───────────────────────────────────────────────────────────
function ArcGauge({ pct = 0, size = 110, label, sub, color }) {
  const r     = (size / 2) - 12;
  const cx    = size / 2, cy = size / 2;
  const circ  = 2 * Math.PI * r;
  const arc   = circ * 0.75;                                // 270°
  const prog  = (Math.min(pct, 100) / 100) * arc;
  const c     = tc(pct, color);

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
      <svg width={size} height={size * 0.86} viewBox={`0 0 ${size} ${size}`}>
        {/* Glow ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth="12"
          strokeLinecap="round" opacity="0.07"
          strokeDasharray={`${prog} ${circ - prog}`}
          transform={`rotate(135 ${cx} ${cy})`}/>
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={D.border} strokeWidth="6.5" strokeLinecap="round"
          strokeDasharray={`${arc} ${circ - arc}`}
          transform={`rotate(135 ${cx} ${cy})`}/>
        {/* Progress */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={c} strokeWidth="6.5" strokeLinecap="round"
          strokeDasharray={`${prog} ${circ - prog}`}
          transform={`rotate(135 ${cx} ${cy})`}
          style={{ transition:"stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)" }}/>
        {/* Value */}
        <text x={cx} y={cy - 2} textAnchor="middle"
          fill={c} fontSize="17" fontWeight="900" fontFamily={MONO}>
          {pct.toFixed(0)}%
        </text>
        <text x={cx} y={cy + 13} textAnchor="middle"
          fill={D.textMuted} fontSize="9" fontWeight="700" fontFamily={SANS}>
          {label}
        </text>
      </svg>
      {sub && (
        <div style={{ fontSize:9, color:D.textMuted, fontFamily:MONO, textAlign:"center", lineHeight:1.4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data = [], color, height = 52, maxVal }) {
  if (data.length < 2)
    return <div style={{ height, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <span style={{ fontSize:10, color:D.textMuted, fontFamily:MONO }}>—</span>
    </div>;

  const W   = 280, H = height;
  const max = maxVal ?? Math.max(...data, 1);
  const toY = v => H - Math.max(3, (v / max) * (H - 4));
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * W},${toY(v)}`).join(" ");
  const lx  = W, ly = toY(data[data.length - 1]);
  const uid = `sp${Math.random().toString(36).slice(2, 7)}`;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill={`url(#${uid})`}/>
      <polyline points={pts} fill="none" stroke={color}
        strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"/>
      {/* Last dot + halo */}
      <circle cx={lx} cy={ly} r="5" fill={color} opacity="0.18"/>
      <circle cx={lx} cy={ly} r="3" fill={color}/>
    </svg>
  );
}

// ─── Mini progress bar ────────────────────────────────────────────────────────
function MiniBar({ pct, color }) {
  return (
    <div style={{ height:3, background:D.border, borderRadius:2, overflow:"hidden", marginTop:5 }}>
      <div style={{
        height:"100%", width:`${Math.min(pct, 100)}%`,
        background:color, borderRadius:2, transition:"width 1s ease",
      }}/>
    </div>
  );
}

// ─── Metric tile ─────────────────────────────────────────────────────────────
function Tile({ label, value, pct, color }) {
  const c = tc(pct ?? 0, color);
  return (
    <div style={{
      padding:"10px 13px",
      background:D.cardAlt,
      border:`1px solid ${D.border}`,
      borderLeft:`3px solid ${c}`,
      borderRadius:10,
      minWidth:0,
    }}>
      <div style={{ fontSize:8.5, color:D.textMuted, fontFamily:SANS, fontWeight:700,
        textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:4 }}>
        {label}
      </div>
      <div style={{ fontSize:15, fontWeight:900, color:c, fontFamily:MONO,
        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
        {value}
      </div>
      {pct !== undefined && <MiniBar pct={pct} color={c}/>}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function Sect({ label }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, margin:"22px 0 12px" }}>
      <span style={{ fontSize:9, fontWeight:700, letterSpacing:"0.18em",
        color:D.textMuted, textTransform:"uppercase", fontFamily:MONO, whiteSpace:"nowrap" }}>
        {label}
      </span>
      <div style={{ flex:1, height:1,
        background:`linear-gradient(90deg, ${D.borderMid}, transparent)` }}/>
    </div>
  );
}

// ─── Sparkline panel ─────────────────────────────────────────────────────────
function SparkPanel({ label, data, color, leftLabel, rightLabel, centerLabel }) {
  const c = color;
  return (
    <div style={{ background:D.bg, border:`1px solid ${D.border}`, borderRadius:12, padding:"12px 14px" }}>
      <div style={{ fontSize:10, color:D.textMuted, fontFamily:MONO, marginBottom:8 }}>
        {label}
      </div>
      <Sparkline data={data} color={c} height={52}/>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
        <span style={{ fontSize:9, color:D.textMuted, fontFamily:MONO }}>{leftLabel}</span>
        <span style={{ fontSize:9, color:c, fontFamily:MONO, fontWeight:700 }}>{centerLabel}</span>
        <span style={{ fontSize:9, color:D.textMuted, fontFamily:MONO }}>{rightLabel}</span>
      </div>
    </div>
  );
}

// ─── VM Metrics Card ──────────────────────────────────────────────────────────
function VmCard({ vm, index }) {
  const [data,    setData]    = useState(null);
  const [history, setHistory] = useState({ cpu:[], mem:[], net:[] });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const n      = vm.name;
    const numCpu = vm.numCpu || 1;

    const [
      cpuMhz, cpuMax, cpuDemand, cpuIdle, cpuReady,
      memConsumed, memMax, memActive, memSwapped,
      diskRead, diskWrite, diskLatency, diskFree, diskCap,
      netRx, netTx, netDropRx, netDropTx,
      powerState, tools, uptime,
    ] = await Promise.all([
      pq(`vmware_vm_cpu_usagemhz_average{vm_name="${n}"}`),
      pq(`vmware_vm_max_cpu_usage{vm_name="${n}"}`),
      pq(`vmware_vm_cpu_demand_average{vm_name="${n}"}`),
      pq(`vmware_vm_cpu_idle_summation{vm_name="${n}"}`),
      pq(`vmware_vm_cpu_ready_summation{vm_name="${n}"}`),
      pq(`vmware_vm_mem_consumed_average{vm_name="${n}"}`),
      pq(`vmware_vm_memory_max{vm_name="${n}"}`),
      pq(`vmware_vm_mem_active_average{vm_name="${n}"}`),
      pq(`vmware_vm_mem_swapped_average{vm_name="${n}"}`),
      pq(`vmware_vm_disk_read_average{vm_name="${n}"}`),
      pq(`vmware_vm_disk_write_average{vm_name="${n}"}`),
      pq(`vmware_vm_disk_maxTotalLatency_latest{vm_name="${n}"}`),
      pq(`vmware_vm_guest_disk_free{vm_name="${n}"}`),
      pq(`vmware_vm_guest_disk_capacity{vm_name="${n}"}`),
      pq(`vmware_vm_net_received_average{vm_name="${n}"}`),
      pq(`vmware_vm_net_transmitted_average{vm_name="${n}"}`),
      pq(`vmware_vm_net_droppedRx_summation{vm_name="${n}"}`),
      pq(`vmware_vm_net_droppedTx_summation{vm_name="${n}"}`),
      pq(`vmware_vm_power_state{vm_name="${n}"}`),
      pq(`vmware_vm_guest_tools_running_status{vm_name="${n}",tools_status="toolsOk"}`),
      pq(`vmware_vm_boot_timestamp_seconds{vm_name="${n}"}`),
    ]);

    // ── CPU  (formule exacte ESXi : MHz utilisés / MHz max × 100) ────────────
    const cpuMhzVal  = firstVal(cpuMhz, 0);
    const cpuMaxMhz  = firstVal(cpuMax, 5836);
    const cpuPct     = cpuMaxMhz > 0 ? Math.min((cpuMhzVal / cpuMaxMhz) * 100, 100) : 0;
    const cpuDemandV = firstVal(cpuDemand, 0);

    // CPU Ready % = summation_ms / (numvCPU × intervalle_ms) × 100
    // L'intervalle temps-réel ESXi est de 20 s = 20 000 ms
    const INTERVAL_MS = 20000;
    const cpuReadyPct = Math.min((firstVal(cpuReady, 0) / (numCpu * INTERVAL_MS)) * 100, 100);
    const cpuIdlePct  = Math.min((firstVal(cpuIdle,  0) / (numCpu * INTERVAL_MS)) * 100, 100);

    // ── Memory ───────────────────────────────────────────────────────────────
    const memConsumedKB = firstVal(memConsumed, 0);
    const memMaxMB      = firstVal(memMax, 4096);
    // memConsumed est en KB, memMax en MB → conversion cohérente
    const memConsumedMB = memConsumedKB / 1024;
    const memPct        = memMaxMB > 0 ? Math.min((memConsumedMB / memMaxMB) * 100, 100) : 0;
    const memActiveMB   = firstVal(memActive, 0) / 1024;
    const memSwappedKB  = firstVal(memSwapped, 0);
    const memFreeMB     = memMaxMB - memConsumedMB;

    // ── Disk ─────────────────────────────────────────────────────────────────
    const diskFreeB   = firstVal(diskFree, 0);
    const diskCapB    = firstVal(diskCap,  1);
    const diskUsedB   = diskCapB - diskFreeB;
    const diskPct     = diskCapB > 0 ? Math.min((diskUsedB / diskCapB) * 100, 100) : 0;
    const diskReadKBs = firstVal(diskRead,    0);
    const diskWrKBs   = firstVal(diskWrite,   0);
    const diskLatMs   = firstVal(diskLatency, 0);

    // ── Network ──────────────────────────────────────────────────────────────
    const netRxKBs = firstVal(netRx, 0);
    const netTxKBs = firstVal(netTx, 0);
    const netDropR  = firstVal(netDropRx, 0);
    const netDropT  = firstVal(netDropTx, 0);
    // Saturation réseau relative à un NIC 1 Gbps (125 000 KB/s)
    const NIC_KBS   = 125000;
    const netPct    = Math.min(((netRxKBs + netTxKBs) / NIC_KBS) * 100, 100);

    // ── État ──────────────────────────────────────────────────────────────────
    const toolsOk = tools.length > 0;
    const bootTs  = firstVal(uptime, 0);
    const uptimeH = bootTs > 0 ? Math.floor((Date.now() / 1000 - bootTs) / 3600) : null;

    setData({
      cpuPct, cpuMhzVal, cpuMaxMhz, cpuDemandV, cpuReadyPct, cpuIdlePct,
      memPct, memConsumedMB, memMaxMB, memActiveMB, memSwappedKB, memFreeMB,
      diskPct, diskUsedB, diskFreeB, diskCapB, diskReadKBs, diskWrKBs, diskLatMs,
      netRxKBs, netTxKBs, netDropR, netDropT, netPct,
      toolsOk, uptimeH,
    });
    setLoading(false);

    // ── Historique 30 min ─────────────────────────────────────────────────────
    const [hMhz, hMem, hRx, hTx] = await Promise.all([
      pqRange(`vmware_vm_cpu_usagemhz_average{vm_name="${n}"}`),
      pqRange(`vmware_vm_mem_consumed_average{vm_name="${n}"}`),
      pqRange(`vmware_vm_net_received_average{vm_name="${n}"}`),
      pqRange(`vmware_vm_net_transmitted_average{vm_name="${n}"}`),
    ]);

    // Même formule que le calcul instantané pour la cohérence graphique
    const cpuH = cpuMaxMhz > 0
      ? hMhz.map(v => Math.min((v / cpuMaxMhz) * 100, 100))
      : [];
    const memH = memMaxMB > 0
      ? hMem.map(v => Math.min((v / 1024 / memMaxMB) * 100, 100))
      : [];
    const netH = hRx.map((v, i) => v + (hTx[i] || 0));

    setHistory({ cpu: cpuH, mem: memH, net: netH });
  }, [vm.name, vm.numCpu]);

  useEffect(() => {
    if (vm.isOnline) { load(); } else { setLoading(false); }
    const id = setInterval(() => { if (vm.isOnline) load(); }, 30000);
    return () => clearInterval(id);
  }, [vm.isOnline, load]);

  const accent = vm.isOnline ? D.online : D.offline;
  const accentBg = vm.isOnline ? D.onlineBg : D.offlineBg;

  return (
    <div style={{
      background: D.card,
      border: `1px solid ${D.border}`,
      borderTop: `2px solid ${accent}`,
      borderRadius: 16,
      overflow: "hidden",
      animation: "fadeUp 0.35s ease both",
      animationDelay: `${index * 0.06}s`,
    }}>
      {/* ── Card header ───────────────────────────────────────────────────── */}
      <div style={{
        padding: "18px 22px 14px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: `1px solid ${D.border}`,
        background: D.cardAlt,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{
            width:42, height:42, borderRadius:10,
            background: accentBg,
            border: `1px solid ${accent}22`,
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke={accent} strokeWidth="1.6" strokeLinecap="round">
              <rect x="2" y="2" width="20" height="8" rx="2"/>
              <rect x="2" y="14" width="20" height="8" rx="2"/>
              <circle cx="6" cy="6" r="1" fill={accent} stroke="none"/>
              <circle cx="6" cy="18" r="1" fill={accent} stroke="none"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:D.text, fontFamily:MONO }}>
              {vm.name}
            </div>
            <div style={{ fontSize:11, color:D.textSub, fontFamily:SANS, marginTop:3 }}>
              {vm.tenant} · {vm.numCpu} vCPU ·{" "}
              {vm.memTotalMB >= 1024
                ? `${(vm.memTotalMB / 1024).toFixed(0)} GB`
                : `${vm.memTotalMB} MB`}
            </div>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {data?.toolsOk && (
            <span style={{
              fontSize:9, fontWeight:700, padding:"3px 8px", borderRadius:5,
              background:D.onlineBg, color:D.online,
              border:`1px solid ${D.online}33`, fontFamily:MONO,
            }}>TOOLS OK</span>
          )}
          {data?.uptimeH != null && (
            <span style={{
              fontSize:9, fontWeight:700, padding:"3px 8px", borderRadius:5,
              background:D.card, color:D.textSub,
              border:`1px solid ${D.border}`, fontFamily:MONO,
            }}>↑ {data.uptimeH}h</span>
          )}
          <span style={{
            display:"inline-flex", alignItems:"center", gap:6,
            padding:"5px 12px", borderRadius:7,
            background:accentBg, border:`1px solid ${accent}33`,
            color:accent, fontSize:9, fontWeight:700, fontFamily:MONO,
          }}>
            <span style={{
              width:5, height:5, borderRadius:"50%", background:accent,
              animation: vm.isOnline ? "pulse 2.5s infinite" : "none",
            }}/>
            {vm.isOnline ? "EN LIGNE" : "HORS LIGNE"}
          </span>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      {!vm.isOnline ? (
        <div style={{ padding:48, textAlign:"center", color:D.textMuted, fontSize:13, fontFamily:MONO }}>
          Machine virtuelle hors ligne
        </div>
      ) : loading ? (
        <div style={{ padding:48, textAlign:"center" }}>
          <div style={{
            width:34, height:34,
            border:`2px solid ${D.border}`, borderTopColor:D.cpu,
            borderRadius:"50%",
            animation:"spin 0.8s linear infinite",
            margin:"0 auto 14px",
          }}/>
          <div style={{ color:D.textMuted, fontSize:11, fontFamily:MONO }}>
            Chargement des métriques…
          </div>
        </div>
      ) : data && (
        <div style={{ padding:"18px 22px 24px" }}>

          {/* Gauge row */}
          <div style={{
            display:"flex", gap:12, justifyContent:"space-around", flexWrap:"wrap",
            padding:"20px 16px",
            background:D.bg, borderRadius:14, border:`1px solid ${D.border}`,
            marginBottom:20,
          }}>
            <ArcGauge pct={data.cpuPct}  size={108} label="CPU"     color={D.cpu}
              sub={`${data.cpuMhzVal.toFixed(0)} / ${data.cpuMaxMhz} MHz`}/>
            <ArcGauge pct={data.memPct}  size={108} label="MÉM"     color={D.mem}
              sub={`${data.memConsumedMB.toFixed(0)} / ${data.memMaxMB} Mo`}/>
            <ArcGauge pct={data.diskPct} size={108} label="DISQUE"  color={D.disk}
              sub={`${(data.diskUsedB/1073741824).toFixed(1)} / ${(data.diskCapB/1073741824).toFixed(1)} Go`}/>
            <ArcGauge pct={data.netPct}  size={108} label="RÉSEAU"  color={D.net}
              sub={`↓${data.netRxKBs.toFixed(0)} ↑${data.netTxKBs.toFixed(0)} KB/s`}/>
          </div>

          {/* ── CPU ─────────────────────────────────────────────────────── */}
          <Sect label="Processeur"/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:4 }}>
            <SparkPanel
              label="Utilisation CPU (30 min)"
              data={history.cpu}
              color={tc(data.cpuPct, D.cpu)}
              leftLabel="0%" centerLabel={`${data.cpuPct.toFixed(1)}%`} rightLabel="100%"/>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <Tile label="Fréquence" value={`${data.cpuMhzVal.toFixed(0)} MHz`}
                pct={data.cpuPct} color={D.cpu}/>
              <Tile label="Demande" value={`${data.cpuDemandV.toFixed(0)} MHz`}
                color={D.cpu}/>
              {/*
                CPU Ready % — formule ESXi exacte :
                ready_summation_ms / (numvCPU × 20 000 ms) × 100
                Seuils : < 2 % normal, 2–5 % attention, > 5 % critique
              */}
              <Tile label="CPU Ready %" value={`${data.cpuReadyPct.toFixed(2)} %`}
                pct={Math.min(data.cpuReadyPct * 10, 100)}
                color={data.cpuReadyPct > 5 ? D.danger : data.cpuReadyPct > 2 ? D.warn : D.online}/>
              {/*
                CPU Idle % — même normalisation que Ready
                idle_summation_ms / (numvCPU × 20 000 ms) × 100
              */}
              <Tile label="CPU Idle %" value={`${data.cpuIdlePct.toFixed(1)} %`}
                pct={data.cpuIdlePct} color={D.online}/>
            </div>
          </div>

          {/* ── Memory ──────────────────────────────────────────────────── */}
          <Sect label="Mémoire"/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:4 }}>
            <SparkPanel
              label="Consommation mémoire (30 min)"
              data={history.mem}
              color={tc(data.memPct, D.mem)}
              leftLabel="0%" centerLabel={`${data.memPct.toFixed(1)}%`} rightLabel="100%"/>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <Tile label="Consommée" value={`${data.memConsumedMB.toFixed(0)} Mo`}
                pct={data.memPct} color={D.mem}/>
              <Tile label="Active" value={`${data.memActiveMB.toFixed(0)} Mo`}
                color={D.mem}/>
              <Tile label="Libre" value={`${data.memFreeMB.toFixed(0)} Mo`}
                pct={100 - data.memPct} color={D.online}/>
              <Tile label="Swappée" value={`${data.memSwappedKB.toFixed(0)} KB`}
                color={data.memSwappedKB > 0 ? D.danger : D.online}/>
            </div>
          </div>

          {/* ── Disk ────────────────────────────────────────────────────── */}
          <Sect label="Stockage"/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:4 }}>
            <div style={{ background:D.bg, border:`1px solid ${D.border}`, borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:10, color:D.textMuted, fontFamily:MONO, marginBottom:10 }}>
                Utilisation disque (guest)
              </div>
              {/* Big bar */}
              <div style={{ height:10, background:D.border, borderRadius:5, overflow:"hidden", marginBottom:12 }}>
                <div style={{
                  height:"100%", width:`${Math.min(data.diskPct, 100)}%`,
                  background:tc(data.diskPct, D.disk),
                  borderRadius:5, transition:"width 1s ease",
                }}/>
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
                <div>
                  <div style={{ fontSize:22, fontWeight:900, color:tc(data.diskPct, D.disk), fontFamily:MONO, lineHeight:1 }}>
                    {data.diskPct.toFixed(1)}%
                  </div>
                  <div style={{ fontSize:9, color:D.textMuted, fontFamily:MONO, marginTop:3 }}>
                    {(data.diskUsedB / 1073741824).toFixed(1)} Go utilisés
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:16, fontWeight:900, color:D.online, fontFamily:MONO, lineHeight:1 }}>
                    {(data.diskFreeB / 1073741824).toFixed(1)} Go
                  </div>
                  <div style={{ fontSize:9, color:D.textMuted, fontFamily:MONO, marginTop:3 }}>
                    libres / {(data.diskCapB / 1073741824).toFixed(1)} Go total
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <Tile label="Lecture" value={`${data.diskReadKBs.toFixed(0)} KB/s`} color={D.cpu}/>
              <Tile label="Écriture" value={`${data.diskWrKBs.toFixed(0)} KB/s`} color={D.warn}/>
              <Tile label="Latence max" value={`${data.diskLatMs.toFixed(0)} ms`}
                color={data.diskLatMs > 20 ? D.danger : D.online}/>
              <Tile label="Capacité" value={`${(data.diskCapB/1073741824).toFixed(1)} Go`} color={D.textSub}/>
            </div>
          </div>

          {/* ── Network ─────────────────────────────────────────────────── */}
          <Sect label="Réseau"/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <SparkPanel
              label="Trafic entrant + sortant (30 min)"
              data={history.net}
              color={D.net}
              leftLabel={`↓ ${data.netRxKBs.toFixed(0)} KB/s`}
              centerLabel={`${(data.netRxKBs + data.netTxKBs).toFixed(0)} KB/s total`}
              rightLabel={`↑ ${data.netTxKBs.toFixed(0)} KB/s`}/>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <Tile label="Réception ↓" value={`${data.netRxKBs.toFixed(0)} KB/s`} color={D.net}/>
              <Tile label="Émission ↑" value={`${data.netTxKBs.toFixed(0)} KB/s`} color={D.cpu}/>
              <Tile label="Perdus ↓" value={String(data.netDropR.toFixed(0))}
                color={data.netDropR > 0 ? D.danger : D.online}/>
              <Tile label="Perdus ↑" value={String(data.netDropT.toFixed(0))}
                color={data.netDropT > 0 ? D.danger : D.online}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Metrics() {
  const [vms,     setVms]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick,    setTick]    = useState(30);
  const [filter,  setFilter]  = useState("all");

  const fetchVMs = useCallback(async () => {
    const [cpuR, pwrR, numCpuR, memMaxR] = await Promise.all([
      pq("vmware_vm_cpu_usagemhz_average"),
      pq("vmware_vm_power_state"),
      pq("vmware_vm_num_cpu"),
      pq("vmware_vm_memory_max"),
    ]);

    const pwrMap = {}, dcMap = {}, numCpuMap = {}, memMap = {};
    pwrR.forEach(r  => { pwrMap[r.metric.vm_name]    = r.value[1] === "1"; });
    cpuR.forEach(r  => { dcMap[r.metric.vm_name]     = r.metric.dc_name || "VMware ESXi"; });
    numCpuR.forEach(r => { numCpuMap[r.metric.vm_name] = parseFloat(r.value[1]); });
    memMaxR.forEach(r => { memMap[r.metric.vm_name]    = parseFloat(r.value[1]); });

    const names = [...new Set([
      ...cpuR.map(r => r.metric.vm_name),
      ...pwrR.map(r => r.metric.vm_name),
    ])];

    const list = names.map(name => ({
      name,
      tenant:     dcMap[name]    || "VMware ESXi",
      isOnline:   pwrMap[name]   ?? false,
      numCpu:     numCpuMap[name] || 0,
      memTotalMB: memMap[name]    || 0,
    })).sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    setVms(list);
    setLoading(false);
    setTick(30);
  }, []);

  useEffect(() => {
    fetchVMs();
    const di = setInterval(fetchVMs, 30000);
    const ti = setInterval(() => setTick(t => t <= 0 ? 30 : t - 1), 1000);
    return () => { clearInterval(di); clearInterval(ti); };
  }, [fetchVMs]);

  const online  = vms.filter(v => v.isOnline).length;
  const offline = vms.length - online;
  const avail   = vms.length > 0 ? ((online / vms.length) * 100).toFixed(1) : null;

  const shown = filter === "online"  ? vms.filter(v => v.isOnline)
              : filter === "offline" ? vms.filter(v => !v.isOnline)
              : vms;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700;900&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.6; transform:scale(1.3); }
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        ::-webkit-scrollbar       { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:#c8d3e6; border-radius:4px; }
      `}</style>

      <div style={{ minHeight:"100vh", background:D.bg, fontFamily:SANS, color:D.text, padding:"24px 28px" }}>

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{
                width:8, height:8, borderRadius:"50%",
                background: online > 0 ? D.online : D.offline,
                display:"inline-block",
                animation:"pulse 2.5s infinite",
              }}/>
              <span style={{ fontSize:19, fontWeight:900, color:D.text, fontFamily:MONO, letterSpacing:"-0.03em" }}>
                VMware · Métriques
              </span>
            </div>
            <div style={{ fontSize:11, color:D.textMuted, fontFamily:MONO, marginTop:4, paddingLeft:18 }}>
              {vms.length} machine{vms.length !== 1 ? "s" : ""} · {online} en ligne · {offline} hors ligne
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {/* Filter tabs */}
            <div style={{ display:"flex", gap:3, background:D.card, borderRadius:10, padding:3, border:`1px solid ${D.border}` }}>
              {[
                { k:"all",     l:`Toutes (${vms.length})` },
                { k:"online",  l:`En ligne (${online})` },
                { k:"offline", l:`Hors ligne (${offline})` },
              ].map(f => (
                <button key={f.k} onClick={() => setFilter(f.k)}
                  style={{
                    padding:"5px 12px", borderRadius:7, cursor:"pointer",
                    fontSize:11, fontWeight:600, fontFamily:SANS,
                    background: filter === f.k ? D.cpuBg : "transparent",
                    color:      filter === f.k ? D.cpu   : D.textMuted,
                    border:     filter === f.k ? `1px solid ${D.cpu}44` : "1px solid transparent",
                    transition:"all 0.15s",
                  }}>
                  {f.l}
                </button>
              ))}
            </div>

            {/* Refresh timer */}
            <div style={{
              display:"flex", alignItems:"center", gap:5,
              padding:"5px 11px", borderRadius:8,
              background: tick <= 5 ? D.warnBg : D.card,
              border: `1px solid ${tick <= 5 ? D.warn + "55" : D.border}`,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke={tick <= 5 ? D.warn : D.textSub} strokeWidth="2.5" strokeLinecap="round"
                style={{ animation:"spin 2s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <span style={{ fontSize:10, fontWeight:700, color:tick <= 5 ? D.warn : D.textSub, fontFamily:MONO }}>
                {tick}s
              </span>
            </div>

            {/* Refresh button */}
            <button onClick={fetchVMs}
              style={{
                width:34, height:34, borderRadius:8,
                border:`1px solid ${D.border}`,
                background:D.card, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center",
                transition:"border-color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = D.cpu + "66"}
              onMouseLeave={e => e.currentTarget.style.borderColor = D.border}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke={D.textSub} strokeWidth="2.2" strokeLinecap="round">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Summary cards ─────────────────────────────────────────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:24 }}>
          {[
            { label:"Total VMs",    value:vms.length, color:D.cpu    },
            { label:"En ligne",     value:online,     color:D.online  },
            { label:"Hors ligne",   value:offline,    color:offline > 0 ? D.danger : D.textMuted },
            { label:"Disponibilité",value:avail ? `${avail}%` : "—",
              color: online === vms.length && vms.length > 0 ? D.online : D.warn },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background:D.card,
              border:`1px solid ${D.border}`,
              borderTop:`2px solid ${color}`,
              borderRadius:12, padding:"16px 20px",
            }}>
              <div style={{ fontSize:30, fontWeight:900, color, fontFamily:MONO, lineHeight:1 }}>
                {value}
              </div>
              <div style={{ fontSize:10, color:D.textMuted, fontFamily:SANS, marginTop:6,
                textTransform:"uppercase", letterSpacing:"0.1em" }}>
                {label}
              </div>
            </div>
          ))}
        </div>

        {/* ── VM Cards ──────────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ textAlign:"center", padding:60 }}>
            <div style={{
              width:36, height:36,
              border:`2px solid ${D.border}`, borderTopColor:D.cpu,
              borderRadius:"50%", animation:"spin 0.8s linear infinite",
              margin:"0 auto 16px",
            }}/>
            <div style={{ color:D.textMuted, fontSize:12, fontFamily:MONO }}>
              Chargement des données…
            </div>
          </div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, color:D.textMuted, fontSize:13, fontFamily:MONO }}>
            Aucune machine virtuelle trouvée.
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {shown.map((vm, idx) => (
              <VmCard key={vm.name} vm={vm} index={idx}/>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

