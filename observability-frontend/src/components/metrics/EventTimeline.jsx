import React, { useEffect, useState } from "react";

export default function EventTimeline() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    async function loadLogs() {
      const resp = await fetch('/api/logs'); // ton backend doit renvoyer JSON avec logs
      const data = await resp.json();
      setEvents(data);
    }
    loadLogs();
    const interval = setInterval(loadLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ maxHeight: '400px', overflowY: 'scroll', border: '1px solid gray', padding: '10px' }}>
      {events.map((e, i) => (
        <div key={i} style={{ color: e.level === 'error' ? 'red' : 'black' }}>
          [{new Date(e.timestamp).toLocaleTimeString()}] {e.message}
        </div>
      ))}
    </div>
  );
}
