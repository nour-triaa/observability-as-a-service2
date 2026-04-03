import { useEffect, useState } from "react";

const PROM = "http://prometheus.local/api/v1/query";

export default function VmToolsStatus({ vmName }) {
  const [tools,   setTools]   = useState(null);
  const [version, setVersion] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTools() {
      try {
        const [resStatus, resVer] = await Promise.all([
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_guest_tools_running_status{vm_name="${vmName}"}`)}`),
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_guest_tools_version{vm_name="${vmName}"}`)}`),
        ]);
        const [jStatus, jVer] = await Promise.all([resStatus.json(), resVer.json()]);

        // Le status est dans le label "tools_status", pas dans la valeur
        const statusMetric = jStatus.data.result.find(r => r.value[1] === "1");
        setTools(statusMetric?.metric?.tools_status || null);

        const verMetric = jVer.data.result.find(r => r.value[1] === "1");
        const ver = verMetric?.metric?.tools_version;
        setVersion(ver && ver !== "0" ? ver : null);
      } catch (e) {
        console.error("VmToolsStatus error:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchTools();
    const id = setInterval(fetchTools, 60000);
    return () => clearInterval(id);
  }, [vmName]);

  // Mapping status → affichage
  const statusMap = {
    toolsOk:           { label: "OK",           color: "#4ade80", icon: "✓" },
    toolsOld:          { label: "OBSOLÈTE",      color: "#fb923c", icon: "!" },
    toolsNotInstalled: { label: "NON INSTALLÉ",  color: "#f87171", icon: "✗" },
    toolsNotRunning:   { label: "ARRÊTÉ",        color: "#fbbf24", icon: "!" },
  };
  const s     = statusMap[tools] || { label: tools || "INCONNU", color: "#475569", icon: "?" };
  const isOk  = tools === "toolsOk";

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
          <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
        </svg>
        <span style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
          VMware Tools
        </span>
      </div>

      {/* Badge status */}
      <div style={{ marginBottom: 10 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 12px", borderRadius: 10,
          background: `${s.color}10`, border: `1px solid ${s.color}25`,
          color: s.color, fontSize: 11, fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: "50%", background: s.color,
            boxShadow: isOk ? `0 0 6px ${s.color}` : "none",
          }} />
          {loading ? "…" : s.label}
        </span>
      </div>

      {/* Version */}
      {!loading && version && (
        <div style={{ fontSize: 10, color: "#334155", fontFamily: "'JetBrains Mono', monospace" }}>
          version <span style={{ color: "#475569" }}>{version}</span>
        </div>
      )}

      {/* Message si absent */}
      {!loading && tools === "toolsNotInstalled" && (
        <div style={{ fontSize: 10, color: "#475569", marginTop: 6, lineHeight: 1.5 }}>
          Installer VMware Tools pour activer les métriques guest (disque, réseau guest, mémoire détaillée)
        </div>
      )}
    </div>
  );
}
