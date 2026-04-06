// src/pages/Metrics.jsx
import { useState, useEffect, useCallback } from "react";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  bg:          "#f4f6f9",
  surface:     "#ffffff",
  surfaceAlt:  "#f9fafb",
  surfaceHov:  "#f1f4f8",
  border:      "#e4e9f0",
  borderLight: "#eef1f6",
  text:        "#0d1117",
  textSub:     "#3d4a5c",
  textMuted:   "#8b97a8",
  blue:        "#1d6af4",
  blueLight:   "#e8f0fe",
  green:       "#12a05a",
  greenLight:  "#e6f7ef",
  red:         "#e03131",
  redLight:    "#fef0f0",
  orange:      "#d4620a",
  orangeLight: "#fff3e8",
  purple:      "#6c3fc2",
  purpleLight: "#f0ebff",
  cyan:        "#0784b5",
  cyanLight:   "#e8f7fd",
  yellow:      "#c4870a",
  yellowLight: "#fffaeb",
  shadow:      "0 1px 3px rgba(13,17,23,0.06), 0 4px 16px rgba(13,17,23,0.04)",
  shadowMd:    "0 4px 12px rgba(13,17,23,0.08), 0 12px 40px rgba(13,17,23,0.06)",
};

const MONO = "'JetBrains Mono', 'Fira Code', monospace";
const SANS = "'DM Sans', system-ui, sans-serif";
const PROM = "http://prometheus.local/api/v1/query";
const PROM_RANGE = "http://prometheus.local/api/v1/query_range";

// ─── Prometheus helpers ───────────────────────────────────────────────────────
async function pq(query) {
  try {
    const res  = await fetch(`${PROM}?query=${encodeURIComponent(query)}`);
    const json = await res.json();
    return json.status === "success" ? json.data.result : [];
  } catch { return []; }
}
function firstVal(r, fb = 0) { return r[0] ? parseFloat(r[0].value[1]) : fb; }

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

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data = [], color, height = 48, maxVal }) {
  if (data.length < 2) {
    return <div style={{ height, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <span style={{ fontSize:10, color:T.textMuted, fontFamily:MONO }}>—</span>
    </div>;
  }
  const W = 260, H = height;
  const max = maxVal ?? Math.max(...data, 1);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - Math.max(2, (v / max) * H);
    return `${x},${y}`;
  }).join(" ");
  const area = `0,${H} ${pts} ${W},${H}`;
  const id = `sp-${color.replace(/[^a-z0-9]/gi, "")}${Math.random().toString(36).slice(2,6)}`;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display:"block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.8"
        strokeLinejoin="round" strokeLinecap="round"/>
      {/* Last point dot */}
      {data.length > 0 && (() => {
        const lx = W;
        const ly = H - Math.max(2, (data[data.length-1] / max) * H);
        return <circle cx={lx} cy={ly} r="3" fill={color}/>;
      })()}
    </svg>
  );
}

// ─── Circular Gauge ───────────────────────────────────────────────────────────
function CircleGauge({ pct = 0, size = 100, label, value, color, light }) {
  const r  = (size / 2) - 9;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct, 100) / 100 * circ;
  const c = color || (pct > 80 ? T.red : pct > 60 ? T.orange : T.blue);
  const l = light || (pct > 80 ? T.redLight : pct > 60 ? T.orangeLight : T.blueLight);
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6 }}>
      <div style={{ position:"relative", width:size, height:size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth="8"/>
          {/* Progress */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={c} strokeWidth="8"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition:"stroke-dasharray 1.2s cubic-bezier(0.4,0,0.2,1)" }}/>
          {/* Center bg */}
          <circle cx={cx} cy={cy} r={r - 6} fill={l} opacity="0.5"/>
        </svg>
        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
          <span style={{ fontSize: size > 90 ? 18 : 14, fontWeight:900, color:c, fontFamily:MONO, lineHeight:1 }}>
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:10, fontWeight:700, color:T.textSub, fontFamily:SANS }}>{label}</div>
        {value && <div style={{ fontSize:9, color:T.textMuted, fontFamily:MONO, marginTop:1 }}>{value}</div>}
      </div>
    </div>
  );
}

// ─── Horizontal Bar ───────────────────────────────────────────────────────────
function HBar({ label, pct, value, color }) {
  const c = color || (pct > 80 ? T.red : pct > 60 ? T.orange : T.green);
  return (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
        <span style={{ fontSize:11, color:T.textSub, fontFamily:SANS }}>{label}</span>
        <span style={{ fontSize:11, fontWeight:700, color:c, fontFamily:MONO }}>{value || `${pct.toFixed(0)}%`}</span>
      </div>
      <div style={{ height:5, background:T.border, borderRadius:3, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${Math.min(pct,100)}%`, background:c, borderRadius:3, transition:"width 1s ease" }}/>
      </div>
    </div>
  );
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────
function Pill({ label, value, color, light }) {
  return (
    <div style={{ padding:"8px 14px", borderRadius:10, background:light||T.blueLight, display:"flex", justifyContent:"space-between", alignItems:"center", gap:12 }}>
      <span style={{ fontSize:10, color:color||T.blue, fontFamily:SANS, fontWeight:600 }}>{label}</span>
      <span style={{ fontSize:14, fontWeight:900, color:color||T.blue, fontFamily:MONO }}>{value}</span>
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHead({ children }) {
  return (
    <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.14em", color:T.textMuted, textTransform:"uppercase", fontFamily:MONO, display:"flex", alignItems:"center", gap:8, margin:"20px 0 12px" }}>
      <span style={{ flex:1, height:1, background:T.border }}/>
      {children}
      <span style={{ flex:1, height:1, background:T.border }}/>
    </div>
  );
}

// ─── VM Metrics Card ─────────────────────────────────────────────────────────
function VmMetricsCard({ vm, index }) {
  const [data,    setData]    = useState(null);
  const [history, setHistory] = useState({ cpu:[], mem:[], net:[], disk:[] });
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    const name = vm.name;
    const [
      cpuUsage, cpuMhz, cpuMax, cpuDemand, cpuIdle, cpuReady,
      memConsumed, memMax, memActive, memSwapped,
      diskRead, diskWrite, diskLatency, diskFree, diskCap,
      netRx, netTx, netDropRx, netDropTx,
      powerState, tools, uptime,
    ] = await Promise.all([
      pq(`vmware_vm_cpu_usage_average{vm_name="${name}"}`),
      pq(`vmware_vm_cpu_usagemhz_average{vm_name="${name}"}`),
      pq(`vmware_vm_max_cpu_usage{vm_name="${name}"}`),
      pq(`vmware_vm_cpu_demand_average{vm_name="${name}"}`),
      pq(`vmware_vm_cpu_idle_summation{vm_name="${name}"}`),
      pq(`vmware_vm_cpu_ready_summation{vm_name="${name}"}`),
      pq(`vmware_vm_mem_consumed_average{vm_name="${name}"}`),
      pq(`vmware_vm_memory_max{vm_name="${name}"}`),
      pq(`vmware_vm_mem_active_average{vm_name="${name}"}`),
      pq(`vmware_vm_mem_swapped_average{vm_name="${name}"}`),
      pq(`vmware_vm_disk_read_average{vm_name="${name}"}`),
      pq(`vmware_vm_disk_write_average{vm_name="${name}"}`),
      pq(`vmware_vm_disk_maxTotalLatency_latest{vm_name="${name}"}`),
      pq(`vmware_vm_guest_disk_free{vm_name="${name}"}`),
      pq(`vmware_vm_guest_disk_capacity{vm_name="${name}"}`),
      pq(`vmware_vm_net_received_average{vm_name="${name}"}`),
      pq(`vmware_vm_net_transmitted_average{vm_name="${name}"}`),
      pq(`vmware_vm_net_droppedRx_summation{vm_name="${name}"}`),
      pq(`vmware_vm_net_droppedTx_summation{vm_name="${name}"}`),
      pq(`vmware_vm_power_state{vm_name="${name}"}`),
      pq(`vmware_vm_guest_tools_running_status{vm_name="${name}",tools_status="toolsOk"}`),
      pq(`vmware_vm_boot_timestamp_seconds{vm_name="${name}"}`),
    ]);

    // CPU %  (usage_average is in MHz * 100 / max, or raw %)
    const cpuMaxMhz    = firstVal(cpuMax, 5836);
    const cpuMhzVal    = firstVal(cpuMhz, 0);
    const cpuPct       = Math.min((cpuMhzVal / cpuMaxMhz) * 100, 100);
    const cpuDemandVal = firstVal(cpuDemand, 0);
    const cpuIdleVal   = firstVal(cpuIdle, 0);
    const cpuReadyVal  = firstVal(cpuReady, 0);

    // Memory
    const memConsumedKB = firstVal(memConsumed, 0);
    const memMaxMB      = firstVal(memMax, 4096);
    const memPct        = Math.min((memConsumedKB / (memMaxMB * 1024)) * 100, 100);
    const memActiveMB   = firstVal(memActive, 0) / 1024;
    const memSwappedKB  = firstVal(memSwapped, 0);

    // Disk (guest)
    const diskFreeB  = firstVal(diskFree, 0);
    const diskCapB   = firstVal(diskCap, 1);
    const diskPct    = diskCapB > 0 ? Math.min(((diskCapB - diskFreeB) / diskCapB) * 100, 100) : 0;
    const diskReadKB = firstVal(diskRead, 0);
    const diskWriteKB= firstVal(diskWrite, 0);
    const diskLatMs  = firstVal(diskLatency, 0);
    const toGB       = b => (b / 1024 / 1024 / 1024).toFixed(1);

    // Network
    const netRxKB  = firstVal(netRx, 0);
    const netTxKB  = firstVal(netTx, 0);
    const netDropR = firstVal(netDropRx, 0);
    const netDropT = firstVal(netDropTx, 0);

    // State
    const isOn     = firstVal(powerState, 0) === 1;
    const toolsOk  = tools.length > 0;
    const bootTs   = firstVal(uptime, 0);
    const uptimeH  = bootTs > 0 ? Math.floor((Date.now()/1000 - bootTs) / 3600) : null;

    setData({ cpuPct, cpuMhzVal, cpuMaxMhz, cpuDemandVal, cpuIdleVal, cpuReadyVal, memPct, memConsumedKB, memMaxMB, memActiveMB, memSwappedKB, diskPct, diskFreeB, diskCapB, diskReadKB, diskWriteKB, diskLatMs, netRxKB, netTxKB, netDropR, netDropT, isOn, toolsOk, uptimeH });
    setLoading(false);

    // Histories (30 min)
    const [hCpu, hMem, hNetRx, hNetTx] = await Promise.all([
      pqRange(`vmware_vm_cpu_usagemhz_average{vm_name="${name}"}`),
      pqRange(`vmware_vm_mem_consumed_average{vm_name="${name}"}`),
      pqRange(`vmware_vm_net_received_average{vm_name="${name}"}`),
      pqRange(`vmware_vm_net_transmitted_average{vm_name="${name}"}`),
    ]);
    const cpuHist  = hCpu.map(v => Math.min((v / cpuMaxMhz) * 100, 100));
    const memHist  = hMem.map(v => Math.min((v / (memMaxMB * 1024)) * 100, 100));
    const netHist  = hNetRx.map((v, i) => v + (hNetTx[i] || 0));
    setHistory({ cpu: cpuHist, mem: memHist, net: netHist, disk: [] });
  }, [vm.name]);

  useEffect(() => {
    if (vm.isOnline) { fetch_(); }
    else { setLoading(false); }
    const id = setInterval(() => { if (vm.isOnline) fetch_(); }, 30000);
    return () => clearInterval(id);
  }, [vm.isOnline, fetch_]);

  const accentColor = vm.isOnline ? T.green : T.red;
  const accentLight = vm.isOnline ? T.greenLight : T.redLight;

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderTop: `3px solid ${accentColor}`,
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: T.shadow,
      animation: `fadeUp 0.4s ease both`,
      animationDelay: `${index * 0.08}s`,
    }}>
      {/* Card Header */}
      <div style={{ padding:"20px 24px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:`1px solid ${T.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:12, background:accentLight, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.8" strokeLinecap="round">
              <rect x="2" y="2" width="20" height="8" rx="2"/>
              <rect x="2" y="14" width="20" height="8" rx="2"/>
              <circle cx="6" cy="6" r="1" fill={accentColor} stroke="none"/>
              <circle cx="6" cy="18" r="1" fill={accentColor} stroke="none"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:T.text, fontFamily:MONO }}>{vm.name}</div>
            <div style={{ fontSize:11, color:T.textMuted, fontFamily:SANS, marginTop:2 }}>
              {vm.tenant} · {vm.numCpu} cœurs · {vm.memTotalMB} Mo
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {data?.toolsOk && (
            <span style={{ fontSize:9, fontWeight:700, padding:"3px 8px", borderRadius:6, background:T.greenLight, color:T.green, fontFamily:MONO }}>
              TOOLS OK
            </span>
          )}
          {data?.uptimeH !== null && data?.uptimeH !== undefined && (
            <span style={{ fontSize:9, fontWeight:700, padding:"3px 8px", borderRadius:6, background:T.blueLight, color:T.blue, fontFamily:MONO }}>
              ↑ {data.uptimeH}h
            </span>
          )}
          <span style={{
            display:"inline-flex", alignItems:"center", gap:5,
            padding:"4px 12px", borderRadius:8,
            background: vm.isOnline ? T.greenLight : T.redLight,
            border: `1px solid ${vm.isOnline ? "#b6ead0" : "#f5c2c2"}`,
            color: vm.isOnline ? T.green : T.red,
            fontSize: 9, fontWeight: 700, fontFamily: MONO,
          }}>
            <span style={{ width:5, height:5, borderRadius:"50%", background: vm.isOnline ? T.green : T.red, animation: vm.isOnline ? "blink 2.5s infinite" : "none" }}/>
            {vm.isOnline ? "EN LIGNE" : "HORS LIGNE"}
          </span>
        </div>
      </div>

      {/* Body */}
      {!vm.isOnline ? (
        <div style={{ padding:40, textAlign:"center", color:T.textMuted, fontSize:13, fontFamily:MONO }}>
          Machine virtuelle hors ligne
        </div>
      ) : loading ? (
        <div style={{ padding:40, textAlign:"center", color:T.textMuted, fontSize:12, fontFamily:MONO }}>
          Chargement des métriques…
        </div>
      ) : data && (
        <div style={{ padding:"20px 24px 24px" }}>

          {/* ── Gauges Row ── */}
          <div style={{ display:"flex", gap:20, justifyContent:"space-around", flexWrap:"wrap", marginBottom:24, padding:"20px", background:T.surfaceAlt, borderRadius:14, border:`1px solid ${T.border}` }}>
            <CircleGauge
              pct={data.cpuPct}
              size={110}
              label="CPU"
              value={`${data.cpuMhzVal} / ${data.cpuMaxMhz} MHz`}
              color={data.cpuPct > 80 ? T.red : data.cpuPct > 60 ? T.orange : T.blue}
              light={data.cpuPct > 80 ? T.redLight : data.cpuPct > 60 ? T.orangeLight : T.blueLight}
            />
            <CircleGauge
              pct={data.memPct}
              size={110}
              label="Mémoire"
              value={`${(data.memConsumedKB/1024).toFixed(0)} / ${data.memMaxMB} Mo`}
              color={data.memPct > 80 ? T.red : data.memPct > 60 ? T.orange : T.purple}
              light={data.memPct > 80 ? T.redLight : data.memPct > 60 ? T.orangeLight : T.purpleLight}
            />
            <CircleGauge
              pct={data.diskPct}
              size={110}
              label="Disque"
              value={`${((data.diskCapB - data.diskFreeB)/1024/1024/1024).toFixed(1)} / ${(data.diskCapB/1024/1024/1024).toFixed(1)} Go`}
              color={data.diskPct > 85 ? T.red : data.diskPct > 70 ? T.orange : T.green}
              light={data.diskPct > 85 ? T.redLight : data.diskPct > 70 ? T.orangeLight : T.greenLight}
            />
            <CircleGauge
              pct={Math.min(((data.netRxKB + data.netTxKB) / 1000) * 100, 100)}
              size={110}
              label="Réseau"
              value={`↓${data.netRxKB.toFixed(0)} ↑${data.netTxKB.toFixed(0)} KB/s`}
              color={T.cyan}
              light={T.cyanLight}
            />
          </div>

          {/* ── CPU Details ── */}
          <SectionHead>Processeur</SectionHead>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            <div style={{ background:T.surfaceAlt, borderRadius:12, padding:"14px 16px", border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, color:T.textMuted, fontFamily:MONO, marginBottom:8 }}>Utilisation (30 min)</div>
              <Sparkline data={history.cpu} color={T.blue} height={56} maxVal={100}/>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                <span style={{ fontSize:10, color:T.textMuted, fontFamily:MONO }}>0%</span>
                <span style={{ fontSize:10, color:T.blue, fontFamily:MONO, fontWeight:700 }}>{data.cpuPct.toFixed(1)}%</span>
                <span style={{ fontSize:10, color:T.textMuted, fontFamily:MONO }}>100%</span>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <Pill label="Demande CPU" value={`${data.cpuDemandVal} MHz`} color={T.blue} light={T.blueLight}/>
              <Pill label="CPU inactif" value={`${data.cpuIdleVal.toFixed(0)} ms`} color={T.green} light={T.greenLight}/>
              <Pill label="CPU prêt (attente)" value={`${data.cpuReadyVal.toFixed(0)} ms`}
                color={data.cpuReadyVal > 500 ? T.red : T.orange}
                light={data.cpuReadyVal > 500 ? T.redLight : T.orangeLight}/>
              <Pill label="Fréquence" value={`${data.cpuMhzVal} MHz`} color={T.purple} light={T.purpleLight}/>
            </div>
          </div>

          {/* ── Memory Details ── */}
          <SectionHead>Mémoire</SectionHead>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            <div style={{ background:T.surfaceAlt, borderRadius:12, padding:"14px 16px", border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, color:T.textMuted, fontFamily:MONO, marginBottom:8 }}>Consommation (30 min)</div>
              <Sparkline data={history.mem} color={T.purple} height={56} maxVal={100}/>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                <span style={{ fontSize:10, color:T.textMuted, fontFamily:MONO }}>0%</span>
                <span style={{ fontSize:10, color:T.purple, fontFamily:MONO, fontWeight:700 }}>{data.memPct.toFixed(1)}%</span>
                <span style={{ fontSize:10, color:T.textMuted, fontFamily:MONO }}>100%</span>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <Pill label="Consommée" value={`${(data.memConsumedKB/1024).toFixed(0)} Mo`} color={T.purple} light={T.purpleLight}/>
              <Pill label="Active" value={`${data.memActiveMB.toFixed(0)} Mo`} color={T.blue} light={T.blueLight}/>
              <Pill label="Swappée" value={`${data.memSwappedKB.toFixed(0)} KB`}
                color={data.memSwappedKB > 0 ? T.red : T.green}
                light={data.memSwappedKB > 0 ? T.redLight : T.greenLight}/>
              <Pill label="Totale" value={`${data.memMaxMB} Mo`} color={T.textSub} light={T.surfaceAlt}/>
            </div>
          </div>

          {/* ── Disk Details ── */}
          <SectionHead>Stockage</SectionHead>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:16 }}>
            <div style={{ background:T.surfaceAlt, borderRadius:12, padding:"14px 16px", border:`1px solid ${T.border}` }}>
              <HBar label="Partition /" pct={data.diskPct}
                value={`${((data.diskCapB-data.diskFreeB)/1024/1024/1024).toFixed(1)} / ${(data.diskCapB/1024/1024/1024).toFixed(1)} Go`}/>
              <div style={{ height:8 }}/>
              <HBar label="Libre" pct={100-data.diskPct}
                value={`${(data.diskFreeB/1024/1024/1024).toFixed(1)} Go`}
                color={T.green}/>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <Pill label="Lecture" value={`${data.diskReadKB.toFixed(0)} KB/s`} color={T.blue} light={T.blueLight}/>
              <Pill label="Écriture" value={`${data.diskWriteKB.toFixed(0)} KB/s`} color={T.orange} light={T.orangeLight}/>
              <Pill label="Latence max" value={`${data.diskLatMs.toFixed(0)} ms`}
                color={data.diskLatMs > 20 ? T.red : T.green}
                light={data.diskLatMs > 20 ? T.redLight : T.greenLight}/>
            </div>
          </div>

          {/* ── Network Details ── */}
          <SectionHead>Réseau</SectionHead>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
            <div style={{ background:T.surfaceAlt, borderRadius:12, padding:"14px 16px", border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, color:T.textMuted, fontFamily:MONO, marginBottom:8 }}>Trafic entrant + sortant (30 min)</div>
              <Sparkline data={history.net} color={T.cyan} height={56}/>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                <span style={{ fontSize:10, color:T.textMuted, fontFamily:MONO }}>Entrant</span>
                <span style={{ fontSize:10, color:T.cyan, fontFamily:MONO, fontWeight:700 }}>
                  {(data.netRxKB + data.netTxKB).toFixed(0)} KB/s
                </span>
                <span style={{ fontSize:10, color:T.textMuted, fontFamily:MONO }}>Sortant</span>
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <Pill label="Réception" value={`${data.netRxKB.toFixed(0)} KB/s`} color={T.cyan} light={T.cyanLight}/>
              <Pill label="Émission" value={`${data.netTxKB.toFixed(0)} KB/s`} color={T.blue} light={T.blueLight}/>
              <Pill label="Paquets perdus ↓" value={data.netDropR.toFixed(0)}
                color={data.netDropR > 0 ? T.red : T.green}
                light={data.netDropR > 0 ? T.redLight : T.greenLight}/>
              <Pill label="Paquets perdus ↑" value={data.netDropT.toFixed(0)}
                color={data.netDropT > 0 ? T.red : T.green}
                light={data.netDropT > 0 ? T.redLight : T.greenLight}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Metrics Page ────────────────────────────────────────────────────────
export default function Metrics() {
  const [vms,     setVms]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [tick,    setTick]    = useState(30);
  const [filter,  setFilter]  = useState("all"); // all | online | offline

  const fetchVMs = useCallback(async () => {
    const [cpuR, pwrR, numCpuR, memMaxR] = await Promise.all([
      pq("vmware_vm_cpu_usage_average"),
      pq("vmware_vm_power_state"),
      pq("vmware_vm_num_cpu"),
      pq("vmware_vm_memory_max"),
    ]);
    const pwrMap    = {};
    const cpuMap    = {};
    const numCpuMap = {};
    const memMap    = {};
    pwrR.forEach(r    => { pwrMap[r.metric.vm_name]    = r.value[1] === "1"; });
    cpuR.forEach(r    => { cpuMap[r.metric.vm_name]    = r.metric.dc_name || "VMware ESXi"; });
    numCpuR.forEach(r => { numCpuMap[r.metric.vm_name] = parseFloat(r.value[1]); });
    memMaxR.forEach(r => { memMap[r.metric.vm_name]    = parseFloat(r.value[1]); });

    const names = [...new Set([...cpuR.map(r => r.metric.vm_name), ...pwrR.map(r => r.metric.vm_name)])];
    const list  = names.map(name => ({
      name,
      tenant:     cpuMap[name]    || "VMware ESXi",
      isOnline:   pwrMap[name]    ?? false,
      numCpu:     numCpuMap[name] || 0,
      memTotalMB: memMap[name]    || 0,
    }));
    list.sort((a, b) => {
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
  const offline = vms.filter(v => !v.isOnline).length;
  const shown   = filter === "online" ? vms.filter(v => v.isOnline) : filter === "offline" ? vms.filter(v => !v.isOnline) : vms;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes blink  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        ::-webkit-scrollbar       { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d8e0; border-radius: 4px; }
      `}</style>

      <div style={{ minHeight:"100vh", background:T.bg, fontFamily:SANS, color:T.text, padding:"28px 32px" }}>

        {/* Page Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
          <div>
            <div style={{ fontSize:20, fontWeight:900, color:T.text, fontFamily:SANS, letterSpacing:"-0.03em" }}>
              Métriques des machines virtuelles
            </div>
            <div style={{ fontSize:11, color:T.textMuted, fontFamily:MONO, marginTop:3 }}>
              {vms.length} machine{vms.length!==1?"s":""} · {online} en ligne · {offline} hors ligne
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {/* Filter tabs */}
            <div style={{ display:"flex", gap:4, background:T.surface, borderRadius:10, padding:4, border:`1px solid ${T.border}` }}>
              {[
                { k:"all",     l:`Toutes (${vms.length})` },
                { k:"online",  l:`En ligne (${online})` },
                { k:"offline", l:`Hors ligne (${offline})` },
              ].map(f => (
                <button key={f.k} onClick={() => setFilter(f.k)}
                  style={{
                    padding:"6px 14px", borderRadius:7, border:"none", cursor:"pointer",
                    fontSize:11, fontWeight:600, fontFamily:SANS,
                    background: filter === f.k ? T.blue : "transparent",
                    color:      filter === f.k ? "#fff" : T.textMuted,
                    transition: "all 0.15s",
                  }}>
                  {f.l}
                </button>
              ))}
            </div>

            {/* Refresh timer */}
            <div style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 12px", borderRadius:9, background:tick<=5?T.orangeLight:T.blueLight, border:`1px solid ${tick<=5?"#f5d9a0":"#c0d8fa"}` }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={tick<=5?T.orange:T.blue} strokeWidth="2.5" strokeLinecap="round" style={{ animation:"spin 2s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <span style={{ fontSize:10, fontWeight:700, color:tick<=5?T.orange:T.blue, fontFamily:MONO }}>{tick}s</span>
            </div>

            {/* Refresh button */}
            <button onClick={fetchVMs}
              style={{ width:36, height:36, borderRadius:9, border:`1px solid ${T.border}`, background:T.surface, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:T.shadow, transition:"all 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background=T.surfaceAlt}
              onMouseLeave={e => e.currentTarget.style.background=T.surface}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textSub} strokeWidth="2.2" strokeLinecap="round">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Summary row */}
        <div style={{ display:"flex", gap:12, marginBottom:24 }}>
          {[
            { label:"Total VMs",   value:vms.length,  color:T.blue,   light:T.blueLight   },
            { label:"En ligne",    value:online,       color:T.green,  light:T.greenLight  },
            { label:"Hors ligne",  value:offline,      color:T.red,    light:T.redLight    },
            { label:"Disponibilité", value:vms.length>0?`${((online/vms.length)*100).toFixed(0)}%`:"—", color:online===vms.length?T.green:T.orange, light:online===vms.length?T.greenLight:T.orangeLight },
          ].map(({ label, value, color, light }) => (
            <div key={label} style={{ flex:1, background:T.surface, border:`1px solid ${T.border}`, borderTop:`2px solid ${color}`, borderRadius:12, padding:"16px 20px", display:"flex", alignItems:"center", gap:12, boxShadow:T.shadow }}>
              <div>
                <div style={{ fontSize:28, fontWeight:900, color, fontFamily:MONO, lineHeight:1 }}>{value}</div>
                <div style={{ fontSize:10, color:T.textMuted, fontFamily:SANS, marginTop:4, textTransform:"uppercase", letterSpacing:"0.08em" }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* VM Cards */}
        {loading ? (
          <div style={{ textAlign:"center", padding:60, color:T.textMuted, fontSize:13, fontFamily:MONO }}>
            Chargement des données…
          </div>
        ) : shown.length === 0 ? (
          <div style={{ textAlign:"center", padding:60, color:T.textMuted, fontSize:13, fontFamily:MONO }}>
            Aucune machine virtuelle trouvée.
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {shown.map((vm, idx) => (
              <VmMetricsCard key={vm.name} vm={vm} index={idx}/>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

