import { useEffect, useState } from "react";

const PROM = "http://prometheus.local/api/v1/query";

export default function PowerStatus({ vmName }) {
  const [state,   setState]   = useState(null);
  const [boot,    setBoot]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPower() {
      try {
        const [resPower, resBoot] = await Promise.all([
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_power_state{vm_name="${vmName}"}`)}`),
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_boot_timestamp_seconds{vm_name="${vmName}"}`)}`),
        ]);
        const [jPower, jBoot] = await Promise.all([resPower.json(), resBoot.json()]);

        // FIX: la valeur est "1" (poweredOn) ou "0" (poweredOff), pas "ON"/"OFF"
        const raw = jPower.data.result[0]?.value[1];
        setState(raw === "1" ? "poweredOn" : raw === "0" ? "poweredOff" : null);

        // Uptime depuis boot timestamp
        if (jBoot.data.result[0]) {
          const bootTs = parseFloat(jBoot.data.result[0].value[1]);
          setBoot(bootTs);
        }
      } catch (e) {
        console.error("PowerStatus error:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchPower();
    const id = setInterval(fetchPower, 30000);
    return () => clearInterval(id);
  }, [vmName]);

  // Calcul uptime lisible
  const getUptime = () => {
    if (!boot) return null;
    const secs  = Math.floor(Date.now() / 1000) - boot;
    const days  = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    const mins  = Math.floor((secs % 3600) / 60);
    if (days > 0)  return `${days}j ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const isOn   = state === "poweredOn";
  const color  = loading ? "#334155" : isOn ? "#4ade80" : "#f87171";
  const uptime = getUptime();

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round">
          <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
        </svg>
        <span style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
          Power
        </span>
      </div>

      {/* État */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%", background: color,
          boxShadow: isOn ? `0 0 8px ${color}` : "none",
          animation: isOn ? "pulse 2.5s ease-in-out infinite" : "none",
        }} />
        <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
          {loading ? "…" : isOn ? "POWERED ON" : state === "poweredOff" ? "POWERED OFF" : "UNKNOWN"}
        </span>
      </div>

      {/* Uptime */}
      {uptime && isOn && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 8,
          background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.12)",
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span style={{ fontSize: 10, color: "#4ade80", fontFamily: "'JetBrains Mono', monospace" }}>
            Uptime: {uptime}
          </span>
        </div>
      )}
    </div>
  );
}

