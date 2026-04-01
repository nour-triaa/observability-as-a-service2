import React, { useEffect, useState } from "react";
import { fetchMetrics } from "./metrics";

export default function KeyMetricsTable() {
  const [metrics, setMetrics] = useState([]);

  useEffect(() => {
    async function load() {
      const data = await fetchMetrics();
      setMetrics(data);
    }
    load();
    const interval = setInterval(load, 5000); // rafraîchit toutes les 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <table>
      <thead>
        <tr>
          <th>Service</th>
          <th>CPU %</th>
          <th>Memory %</th>
          <th>Requests/s</th>
          <th>Errors</th>
        </tr>
      </thead>
      <tbody>
        {metrics.map(m => (
          <tr key={m.service} style={{ color: m.cpu > 90 || m.errors > 0 ? 'red' : 'black' }}>
            <td>{m.service}</td>
            <td>{m.cpu.toFixed(2)}</td>
            <td>{m.memory}</td>
            <td>{m.requests}</td>
            <td>{m.errors}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
