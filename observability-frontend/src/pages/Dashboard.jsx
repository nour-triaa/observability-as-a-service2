// Remplacement uniquement du bloc logo dans le Topbar de Dashboard.jsx
// Cherchez ce bloc dans votre Dashboard.jsx et remplacez-le :

// ─── AVANT (à remplacer) ───────────────────────────────────────────────────────
/*
<div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #1d4ed8, #3b82f6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round">
    <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
  </svg>
</div>
<div>
  <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>VMware ESXi</div>
  <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>MONITORING DASHBOARD</div>
</div>
*/

// ─── APRÈS (copiez ce bloc) ────────────────────────────────────────────────────
/*
<img
  src="/home/nourchene/Pictures/next.png"
  alt="Logo"
  style={{
    height: 38,
    width: "auto",
    objectFit: "contain",
    borderRadius: 8,
    filter: "drop-shadow(0 0 6px rgba(37,99,235,0.35))",
  }}
/>
<div>
  <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>VMware ESXi</div>
  <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>MONITORING DASHBOARD</div>
</div>
*/

// ─── Fichier Dashboard.jsx complet avec logo intégré ──────────────────────────
import { useState, useEffect, useCallback } from "react";
import CpuGraph from "../components/metrics/CpuGraph";
import DiskUsage from "../components/metrics/DiskUsage";
import PowerStatus from "../components/metrics/PowerStatus";
import NetworkGraph from "../components/metrics/NetworkGraph";

const LOGO_PATH = "/home/nourchene/Pictures/next.png";

// ─── Palette light ────────────────────────────────────────────────────────────
const T = {
  bg:          "#f0f4f8",
  surface:     "#ffffff",
  surfaceAlt:  "#f8fafc",
  border:      "#e2e8f0",
  text:        "#0f172a",
  textSub:     "#475569",
  textMuted:   "#94a3b8",
  blue:        "#2563eb",
  blueLight:   "#dbeafe",
  green:       "#16a34a",
  greenLight:  "#dcfce7",
  red:         "#dc2626",
  redLight:    "#fee2e2",
  orange:      "#ea580c",
  orangeLight: "#ffedd5",
  purple:      "#7c3aed",
  purpleLight: "#ede9fe",
  yellow:      "#d97706",
  yellowLight: "#fef3c7",
};

// ─── Prometheus helper ────────────────────────────────────────────────────────
const PROM = "http://prometheus.local/api/v1/query";
async function pq(query) {
  const res  = await fetch(`${PROM}?query=${encodeURIComponent(query)}`);
  const json = await res.json();
  return json.status === "success" ? json.data.result : [];
}
function firstVal(results, fallback = 0) {
  return results[0] ? parseFloat(results[0].value[1]) : fallback;
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ state }) {
  const map = {
    Online:  { bg: T.greenLight,  border: "#bbf7d0", color: T.green,  label: "ONLINE"  },
    Offline: { bg: T.redLight,    border: "#fecaca", color: T.red,    label: "OFFLINE" },
    Unknown: { bg: T.yellowLight, border: "#fde68a", color: T.yellow, label: "UNKNOWN" },
  };
  const c = map[state] || map.Unknown;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 20,
      background: c.bg, border: `1px solid ${c.border}`,
      color: c.color, fontSize: 9, fontWeight: 700,
      letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace",
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%", background: c.color,
        animation: state === "Online" ? "pulse 2.5s ease-in-out infinite" : "none",
      }} />
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
  const track  = isNA ? T.border : pct > 85 ? "#fecaca" : pct > 65 ? "#fed7aa" : "#bbf7d0";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 9, color: T.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace" }}>Mémoire</span>
        <span style={{ fontSize: 11, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
          {isNA ? "N/A" : `${pct.toFixed(0)}%`}
        </span>
      </div>
      <div style={{ height: 5, background: track, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: isNA ? "0%" : `${pct}%`, background: color, borderRadius: 4, transition: "width 1s cubic-bezier(0.4,0,0.2,1)" }} />
      </div>
      <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4, fontFamily: "'JetBrains Mono', monospace" }}>
        {isNA ? "VMware Tools absent" : `${usedMB.toFixed(0)} MB / ${totalMB.toFixed(0)} MB`}
      </div>
    </div>
  );
}

// ─── SectionLabel ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: T.textMuted,
      textTransform: "uppercase", margin: "20px 0 10px",
      fontFamily: "'JetBrains Mono', monospace",
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ flex: 1, height: "1px", background: T.border }} />
      {children}
      <span style={{ flex: 1, height: "1px", background: T.border }} />
    </div>
  );
}

// ─── GraphBox ─────────────────────────────────────────────────────────────────
function GraphBox({ children }) {
  return (
    <div style={{
      borderRadius: 10, background: T.surface,
      border: `1px solid ${T.border}`,
      padding: "14px 16px", marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, bgColor, accent }) {
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderTop: `3px solid ${accent}`,
      borderRadius: 14, padding: "16px 20px",
      display: "flex", alignItems: "center", gap: 14,
      flex: "1 1 150px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}>
      <div style={{ width: 42, height: 42, borderRadius: 12, background: bgColor, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 30, fontWeight: 900, color: T.text, lineHeight: 1, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</div>
      </div>
    </div>
  );
}

// ─── HostInfoBar ──────────────────────────────────────────────────────────────
function HostInfoBar({ hostData }) {
  if (!hostData) return null;
  const cpuPct = hostData.cpuMax  > 0 ? ((hostData.cpuUsage  / hostData.cpuMax)  * 100).toFixed(0) : 0;
  const memPct = hostData.memMax  > 0 ? ((hostData.memUsage  / hostData.memMax)  * 100).toFixed(0) : 0;
  const cpuColor = cpuPct > 80 ? T.red : cpuPct > 60 ? T.orange : T.blue;
  const memColor = memPct > 80 ? T.red : memPct > 60 ? T.orange : T.purple;

  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`,
      borderRadius: 14, padding: "16px 22px", marginBottom: 14,
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0,
      boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 24, marginRight: 24, borderRight: `1px solid ${T.border}` }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: T.blueLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>ESXi Host</div>
          <div style={{ fontSize: 10, color: T.blue, fontFamily: "'JetBrains Mono', monospace" }}>v{hostData.version}</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
        <HostMetric label="CPU"        value={`${cpuPct}%`}              sub={`${hostData.cpuUsage} / ${hostData.cpuMax} MHz`}                     color={cpuColor} />
        <HostMetric label="RAM"        value={`${memPct}%`}              sub={`${hostData.memUsage.toFixed(0)} / ${hostData.memMax.toFixed(0)} MB`} color={memColor} />
        <HostMetric label="vCPUs"      value={`${hostData.numCpu} cores`}                                                                            color={T.green}  />
        <HostMetric label="Modèle CPU" value={hostData.cpuModel}                                                                                     color={T.textSub} truncate />
      </div>
    </div>
  );
}
function HostMetric({ label, value, sub, color, truncate }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: T.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'JetBrains Mono', monospace", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace", maxWidth: truncate ? 200 : undefined, overflow: truncate ? "hidden" : undefined, textOverflow: truncate ? "ellipsis" : undefined, whiteSpace: truncate ? "nowrap" : undefined }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{sub}</div>}
    </div>
  );
}

// ─── DatastoreBar ─────────────────────────────────────────────────────────────
function DatastoreBar({ dsData }) {
  if (!dsData) return null;
  const usedBytes  = dsData.capacity - dsData.free;
  const pct        = dsData.capacity > 0 ? (usedBytes / dsData.capacity * 100).toFixed(0) : 0;
  const toGB       = b => (b / 1024 / 1024 / 1024).toFixed(1);
  const color      = pct > 85 ? T.red    : pct > 70 ? T.orange    : T.green;
  const colorLight = pct > 85 ? T.redLight : pct > 70 ? T.orangeLight : T.greenLight;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 22px", marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: T.purpleLight, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2" strokeLinecap="round">
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0018 0V5"/><path d="M3 12a9 3 0 0018 0"/>
            </svg>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>Datastore</span>
          <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>{dsData.name}</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color, padding: "3px 10px", borderRadius: 8, background: colorLight, fontFamily: "'JetBrains Mono', monospace" }}>
          {toGB(usedBytes)} / {toGB(dsData.capacity)} GB · {pct}%
        </span>
      </div>
      <div style={{ height: 7, background: T.border, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 1s ease" }} />
      </div>
      <div style={{ display: "flex", gap: 20, marginTop: 8 }}>
        <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>Libre : {toGB(dsData.free)} GB</span>
        <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>Provisionné : {toGB(dsData.provisioned)} GB</span>
        <span style={{ fontSize: 10, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>VMs : {dsData.vms}</span>
      </div>
    </div>
  );
}

// ─── VmCard ───────────────────────────────────────────────────────────────────
function VmCard({ vm, isOpen, onToggle, index }) {
  const [memData, setMemData] = useState({ consumedKB: null, totalMB: null });
  const isOnline     = vm.powerState === "Online";
  const accentColor  = isOnline ? T.green      : T.red;
  const accentLight  = isOnline ? T.greenLight  : T.redLight;
  const accentBorder = isOnline ? "#bbf7d0"     : "#fecaca";

  useEffect(() => {
    async function fetchMemory() {
      try {
        const [resConsumed, resTotal] = await Promise.all([
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_mem_consumed_average{vm_name="${vm.name}"}`)}`),
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_memory_max{vm_name="${vm.name}"}`)}`),
        ]);
        const [dConsumed, dTotal] = await Promise.all([resConsumed.json(), resTotal.json()]);
        const consumedKB = dConsumed?.data?.result?.[0]?.value?.[1] ? parseFloat(dConsumed.data.result[0].value[1]) : null;
        const totalMB    = dTotal?.data?.result?.[0]?.value?.[1]    ? parseFloat(dTotal.data.result[0].value[1])    : null;
        setMemData({ consumedKB, totalMB });
      } catch (err) { console.error("Erreur mémoire:", err); }
    }
    fetchMemory();
    const id = setInterval(fetchMemory, 10000);
    return () => clearInterval(id);
  }, [vm.name]);

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${isOpen ? T.blue : T.border}`,
      borderLeft: `4px solid ${accentColor}`,
      borderRadius: 14, overflow: "hidden",
      animation: `fadeUp 0.4s ease both`,
      animationDelay: `${index * 0.07}s`,
      transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
      boxShadow: isOpen ? `0 4px 24px rgba(37,99,235,0.1)` : "0 1px 4px rgba(0,0,0,0.05)",
    }}
    onMouseEnter={e => { if (!isOpen) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.09)"; }}}
    onMouseLeave={e => { if (!isOpen) { e.currentTarget.style.transform = "translateY(0)";    e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05)"; }}}
    >
      <div onClick={onToggle} style={{ padding: "16px 20px", cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: accentLight, border: `1px solid ${accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/>
              <circle cx="6" cy="6"  r="1" fill={accentColor} stroke="none"/>
              <circle cx="6" cy="18" r="1" fill={accentColor} stroke="none"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'JetBrains Mono', monospace" }}>{vm.name}</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>{vm.tenant} · {vm.numCpu} vCPU · {vm.memTotalMB} MB RAM</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <StatusBadge state={vm.powerState} />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textMuted} strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.3s ease" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>
        <div style={{ marginTop: 14, padding: "10px 14px", background: T.surfaceAlt, borderRadius: 8, border: `1px solid ${T.border}` }}>
          <MemoryBar consumedKB={memData.consumedKB} totalMB={memData.totalMB} />
        </div>
      </div>

      <div style={{ maxHeight: isOpen ? "4000px" : "0", overflow: "hidden", transition: "max-height 0.6s cubic-bezier(0.4,0,0.2,1)" }}>
        <div style={{ borderTop: `1px solid ${T.border}`, padding: "4px 20px 24px", background: T.surfaceAlt }}>
          <SectionLabel>CPU</SectionLabel>
          <GraphBox><CpuGraph vmName={vm.name} /></GraphBox>
          <SectionLabel>Stockage</SectionLabel>
          <GraphBox><DiskUsage vmName={vm.name} /></GraphBox>
          <SectionLabel>Alimentation</SectionLabel>
          <GraphBox><PowerStatus vmName={vm.name} /></GraphBox>
          <SectionLabel>Réseau</SectionLabel>
          <GraphBox><NetworkGraph vmName={vm.name} /></GraphBox>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [vms,         setVms]         = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [openVm,      setOpenVm]      = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [tick,        setTick]        = useState(30);
  const [hostData,    setHostData]    = useState(null);
  const [dsData,      setDsData]      = useState(null);

  const fetchVMs = useCallback(async () => {
    try {
      const [cpuResults, powerResults] = await Promise.all([
        pq("vmware_vm_cpu_usage_average"),
        pq("vmware_vm_power_state"),
      ]);

      const powerMap = {};
      powerResults.forEach(r => {
        const name = r.metric.vm_name;
        const val  = r.value[1];
        powerMap[name] = val === "1" ? "Online" : "Offline";
      });

      const allVmNames = [...new Set([
        ...cpuResults.map(r => r.metric.vm_name),
        ...powerResults.map(r => r.metric.vm_name),
      ])];

      const vmList = await Promise.all(
        allVmNames.map(async (name) => {
          const cpuItem = cpuResults.find(r => r.metric.vm_name === name);
          const tenant  = cpuItem?.metric?.dc_name || "VMware ESXi";

          const [consumedR, memMaxR, numCpuR] = await Promise.all([
            pq(`vmware_vm_mem_consumed_average{vm_name="${name}"}`),
            pq(`vmware_vm_memory_max{vm_name="${name}"}`),
            pq(`vmware_vm_num_cpu{vm_name="${name}"}`),
          ]);

          const consumedKB  = firstVal(consumedR);
          const totalMB     = firstVal(memMaxR);
          const numCpu      = firstVal(numCpuR, 0);
          const totalKB     = totalMB * 1024;
          const memPct      = totalKB > 0 ? Math.min((consumedKB / totalKB) * 100, 100).toFixed(1) : "N/A";
          const powerState  = powerMap[name] ?? "Unknown";

          return {
            name, tenant, powerState,
            memoryUsage: memPct, memoryConsumedMB: consumedKB / 1024,
            memoryTotalMB: totalMB, numCpu, memTotalMB: totalMB,
          };
        })
      );

      vmList.sort((a, b) => {
        if (a.powerState !== b.powerState) {
          if (a.powerState === "Online")  return -1;
          if (b.powerState === "Online")  return  1;
          if (a.powerState === "Offline") return -1;
          return 1;
        }
        return a.name.localeCompare(b.name);
      });

      setVms(vmList);

      const [hCpuUsage, hCpuMax, hMemUsage, hMemMax, hNumCpu, hProduct, hHardware] = await Promise.all([
        pq("vmware_host_cpu_usage"), pq("vmware_host_cpu_max"),
        pq("vmware_host_memory_usage"), pq("vmware_host_memory_max"),
        pq("vmware_host_num_cpu"), pq("vmware_host_product_info"), pq("vmware_host_hardware_info"),
      ]);
      setHostData({
        cpuUsage: firstVal(hCpuUsage), cpuMax: firstVal(hCpuMax),
        memUsage: firstVal(hMemUsage), memMax: firstVal(hMemMax),
        numCpu:   firstVal(hNumCpu),
        version:  hProduct[0]?.metric?.version || "—",
        cpuModel: hHardware[0]?.metric?.hardware_cpu_model || "—",
      });

      const [dsCap, dsFree, dsProv, dsVms] = await Promise.all([
        pq("vmware_datastore_capacity_size"), pq("vmware_datastore_freespace_size"),
        pq("vmware_datastore_provisoned_size"), pq("vmware_datastore_vms"),
      ]);
      if (dsCap.length) {
        setDsData({ name: dsCap[0]?.metric?.ds_name || "datastore1", capacity: firstVal(dsCap), free: firstVal(dsFree), provisioned: firstVal(dsProv), vms: firstVal(dsVms) });
      }

      setLastUpdated(new Date());
      setError(null);
      setTick(30);
    } catch (err) {
      console.error(err);
      setError("Impossible de joindre Prometheus.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVMs();
    const dataI = setInterval(fetchVMs, 30000);
    const tickI = setInterval(() => setTick(t => t <= 0 ? 30 : t - 1), 1000);
    return () => { clearInterval(dataI); clearInterval(tickI); };
  }, [fetchVMs]);

  const online  = vms.filter(v => v.powerState === "Online").length;
  const offline = vms.filter(v => v.powerState === "Offline").length;
  const unknown = vms.filter(v => v.powerState === "Unknown").length;
  const uptime  = vms.length ? `${((online / vms.length) * 100).toFixed(0)}%` : "—";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        ::-webkit-scrollbar       { width: 5px; }
        ::-webkit-scrollbar-track { background: #f1f5f9; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
      `}</style>

      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: "'Inter', sans-serif", color: T.text }}>

        {/* ── Topbar ── */}
        <div style={{
          height: 58, display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 32px", background: T.surface, borderBottom: `1px solid ${T.border}`,
          position: "sticky", top: 0, zIndex: 100, boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* ── Logo personnalisé (remplace le carré bleu SVG) ── */}
            <img
              src={LOGO_PATH}
              alt="Logo"
              style={{
                height: 38,
                width: "auto",
                objectFit: "contain",
                borderRadius: 8,
                filter: "drop-shadow(0 0 6px rgba(37,99,235,0.35))",
              }}
            />
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: T.text, letterSpacing: "-0.02em" }}>VMware ESXi</div>
              <div style={{ fontSize: 9, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.1em" }}>MONITORING DASHBOARD</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {lastUpdated && (
              <div style={{ fontSize: 11, color: T.textMuted, fontFamily: "'JetBrains Mono', monospace" }}>
                Mis à jour : {lastUpdated.toLocaleTimeString()}
              </div>
            )}
            <div style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20,
              background: tick <= 5 ? T.orangeLight : T.blueLight,
              border: `1px solid ${tick <= 5 ? "#fed7aa" : "#bfdbfe"}`,
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                stroke={tick <= 5 ? T.orange : T.blue} strokeWidth="2.5" strokeLinecap="round"
                style={{ animation: "spin 2s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              <span style={{ fontSize: 10, fontWeight: 700, color: tick <= 5 ? T.orange : T.blue, fontFamily: "'JetBrains Mono', monospace" }}>{tick}s</span>
            </div>
            <button onClick={fetchVMs} title="Rafraîchir"
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: T.surface, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.background = T.surfaceAlt}
              onMouseLeave={e => e.currentTarget.style.background = T.surface}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textSub} strokeWidth="2.2" strokeLinecap="round">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Content ── */}
        <div style={{ padding: "24px 32px", maxWidth: 1280, margin: "0 auto" }}>

          <HostInfoBar hostData={hostData} />
          <DatastoreBar dsData={dsData} />

          {/* Stats */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 18 }}>
            <StatCard label="VM Online"     value={online}     bgColor={T.greenLight}  accent={T.green}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>} />
            <StatCard label="VM Offline"    value={offline}    bgColor={T.redLight}    accent={T.red}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>} />
            <StatCard label="Disponibilité" value={uptime}     bgColor={T.blueLight}   accent={T.blue}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>} />
            <StatCard label="Total VMs"     value={vms.length} bgColor={T.purpleLight}  accent={T.purple}
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.purple} strokeWidth="2" strokeLinecap="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg>} />
          </div>

          {/* VM Quick Nav */}
          {vms.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              {vms.map(vm => {
                const isActive = openVm === vm.name;
                const dotColor = vm.powerState === "Online" ? T.green : vm.powerState === "Offline" ? T.red : T.yellow;
                return (
                  <div key={vm.name} onClick={() => setOpenVm(openVm === vm.name ? null : vm.name)}
                    style={{
                      padding: "6px 14px", borderRadius: 20, cursor: "pointer", transition: "all 0.15s",
                      background: isActive ? T.blueLight : T.surface,
                      border: `1px solid ${isActive ? "#bfdbfe" : T.border}`,
                      display: "flex", alignItems: "center", gap: 7,
                      boxShadow: isActive ? "0 0 0 2px #bfdbfe" : "none",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.surfaceAlt; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = T.surface; }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, animation: vm.powerState === "Online" ? "pulse 2.5s ease-in-out infinite" : "none" }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? T.blue : T.textSub, fontFamily: "'JetBrains Mono', monospace" }}>{vm.name}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Error / Loading */}
          {error && (
            <div style={{ padding: "12px 16px", borderRadius: 10, background: T.redLight, border: `1px solid #fecaca`, color: T.red, fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {error}
            </div>
          )}
          {loading && (
            <div style={{ textAlign: "center", padding: 48, color: T.textMuted, fontSize: 13, fontFamily: "'JetBrains Mono', monospace" }}>
              Connexion à Prometheus…
            </div>
          )}

          {/* VM Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {vms.map((vm, idx) => (
              <VmCard key={vm.name} vm={vm} index={idx}
                isOpen={openVm === vm.name}
                onToggle={() => setOpenVm(openVm === vm.name ? null : vm.name)}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
