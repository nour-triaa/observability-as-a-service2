import { useEffect, useState } from "react";

const PROM = "http://prometheus.local/api/v1/query";

// ─── Graphe circulaire SVG ────────────────────────────────────────────────────
function DiskDonut({ pct, usedGB, totalGB, partition }) {
  const r     = 40;
  const circ  = 2 * Math.PI * r;
  const dash  = circ - (Math.min(pct, 100) / 100) * circ;
  const color = pct > 85 ? "#dc2626" : pct > 65 ? "#ea580c" : "#16a34a";
  const track = pct > 85 ? "#fee2e2" : pct > 65 ? "#ffedd5" : "#dcfce7";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      {/* Donut SVG */}
      <div style={{ position: "relative", width: 96, height: 96, flexShrink: 0 }}>
        <svg width="96" height="96" viewBox="0 0 96 96">
          {/* Track */}
          <circle cx="48" cy="48" r={r} fill="none" stroke={track} strokeWidth="10" />
          {/* Progress */}
          <circle
            cx="48" cy="48" r={r}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={circ}
            strokeDashoffset={dash}
            strokeLinecap="round"
            transform="rotate(-90 48 48)"
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1), stroke 0.4s" }}
          />
        </svg>
        {/* Centre */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 16, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>
            {pct.toFixed(0)}%
          </span>
          <span style={{ fontSize: 8, color: "#94a3b8", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
            utilisé
          </span>
        </div>
      </div>

      {/* Légende */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", fontFamily: "'JetBrains Mono', monospace", marginBottom: 8 }}>
          {partition}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <LegendRow dot={color}      label="Utilisé" value={`${usedGB} GB`} />
          <LegendRow dot="#e2e8f0"    label="Libre"   value={`${(parseFloat(totalGB) - parseFloat(usedGB)).toFixed(1)} GB`} />
          <LegendRow dot="#cbd5e1"    label="Total"   value={`${totalGB} GB`} bold />
        </div>
      </div>
    </div>
  );
}

function LegendRow({ dot, label, value, bold }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
      <span style={{ fontSize: 10, color: "#64748b", flex: 1 }}>{label}</span>
      <span style={{ fontSize: 10, fontWeight: bold ? 700 : 500, color: "#0f172a", fontFamily: "'JetBrains Mono', monospace" }}>{value}</span>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function DiskUsage({ vmName }) {
  const [disks,   setDisks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [noData,  setNoData]  = useState(false);

  useEffect(() => {
    async function fetchDisk() {
      try {
        const [resFree, resCap] = await Promise.all([
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_guest_disk_free{vm_name="${vmName}"}`)}`),
          fetch(`${PROM}?query=${encodeURIComponent(`vmware_vm_guest_disk_capacity{vm_name="${vmName}"}`)}`),
        ]);
        const [jFree, jCap] = await Promise.all([resFree.json(), resCap.json()]);

        if (!jFree.data.result.length || !jCap.data.result.length) {
          setNoData(true);
          setLoading(false);
          return;
        }

        // Grouper capacity par partition
        const capMap = {};
        jCap.data.result.forEach(r => {
          capMap[r.metric.partition || "/"] = parseFloat(r.value[1]);
        });

        const diskList = jFree.data.result.map(r => {
          const partition = r.metric.partition || "/";
          const freeBytes = parseFloat(r.value[1]);
          const capBytes  = capMap[partition] || 0;
          const usedBytes = capBytes - freeBytes;
          const pct       = capBytes > 0 ? (usedBytes / capBytes * 100) : 0;
          return {
            partition,
            freeGB:  (freeBytes  / 1024 / 1024 / 1024).toFixed(1),
            usedGB:  (usedBytes  / 1024 / 1024 / 1024).toFixed(1),
            totalGB: (capBytes   / 1024 / 1024 / 1024).toFixed(1),
            pct:     parseFloat(pct.toFixed(1)),
          };
        });

        setDisks(diskList);
        setNoData(false);
      } catch (e) {
        console.error("DiskUsage error:", e);
        setNoData(true);
      } finally {
        setLoading(false);
      }
    }
    fetchDisk();
    const id = setInterval(fetchDisk, 30000);
    return () => clearInterval(id);
  }, [vmName]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M3 5v14a9 3 0 0018 0V5"/>
          <path d="M3 12a9 3 0 0018 0"/>
        </svg>
        <span style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
          Stockage
        </span>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ color: "#94a3b8", fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>…</div>
      )}

      {/* VMware Tools absent */}
      {!loading && noData && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 14px", borderRadius: 10,
          background: "#fef3c7", border: "1px solid #fde68a",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div>
            <div style={{ fontSize: 11, color: "#d97706", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
              VMware Tools absent
            </div>
            <div style={{ fontSize: 10, color: "#92400e", marginTop: 2 }}>
              Métriques disque guest indisponibles pour cette VM
            </div>
          </div>
        </div>
      )}

      {/* Donuts par partition */}
      {!loading && !noData && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {disks.map(disk => (
            <DiskDonut
              key={disk.partition}
              pct={disk.pct}
              usedGB={disk.usedGB}
              totalGB={disk.totalGB}
              partition={disk.partition}
            />
          ))}
        </div>
      )}
    </div>
  );
}

