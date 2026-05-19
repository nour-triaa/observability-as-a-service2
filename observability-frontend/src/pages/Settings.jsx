// src/pages/ReporterTest.jsx
import { useState, useEffect } from 'react';

const BASE_URL = 'http://reporter.local';

function ReporterTest() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${BASE_URL}/api/reports`);
      if (!res.ok) throw new Error('Erreur lors du chargement');
      const data = await res.json();

      const list = Array.isArray(data)         ? data
                 : Array.isArray(data.data)    ? data.data
                 : Array.isArray(data.reports) ? data.reports
                 : [];

      setReports(list);
      setMessage('✅ Rapports chargés avec succès');
    } catch (err) {
      setMessage('❌ Erreur: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    setGenerating(true);
    setMessage('');
    try {
      const res = await fetch(`${BASE_URL}/api/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: "Rapport de Test " + new Date().toLocaleDateString(),
          type: "summary",
          generatedBy: "React Test Page"
        }),
      });
      if (!res.ok) throw new Error('Échec de la génération');
      setMessage('🚀 Rapport généré avec succès !');
      await fetchReports();
    } catch (err) {
      setMessage('❌ Erreur génération: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = async (id) => {
    try {
      const res = await fetch(`${BASE_URL}/api/reports/${id}/download`);
      if (!res.ok) throw new Error('Erreur téléchargement');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setMessage(`📥 Téléchargement du rapport ${id} démarré`);
    } catch (err) {
      setMessage('❌ Erreur téléchargement: ' + err.message);
    }
  };

  return (
    <div style={{
      padding: '30px',
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f4f6f9',
      minHeight: '100vh',
      color: '#333'
    }}>
      <h1 style={{ color: '#1e3a8a' }}>🧪 Reporter</h1>
      <p><strong></strong> </p>

      <div style={{ margin: '20px 0' }}>
        <button onClick={fetchReports} disabled={loading} style={btnStyle}>
          {loading ? 'Chargement...' : '📋 Lister les rapports'}
        </button>
        <button
          onClick={generateReport}
          disabled={generating}
          style={{ ...btnStyle, background: '#28a745' }}
        >
          {generating ? 'Génération en cours...' : '⚡ Générer un nouveau rapport'}
        </button>
      </div>

      {message && (
        <p style={{
          padding: '12px',
          background: '#e0f2fe',
          color: '#1e40af',
          borderRadius: '6px',
          border: '1px solid #bae6fd'
        }}>
          {message}
        </p>
      )}

      <h2>Rapports disponibles :</h2>

      {reports.length === 0 ? (
        <p>Aucun rapport trouvé.</p>
      ) : (
        <table border="1" cellPadding="12" style={{
          width: '100%',
          borderCollapse: 'collapse',
          background: 'white'
        }}>
          <thead>
            <tr style={{ background: '#f1f5f9' }}>
              <th>ID</th>
              <th>Nom / Titre</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report.id}>
                <td>{report.id}</td>
                <td>{report.title || report.name || 'Sans titre'}</td>
                <td>{report.createdAt || 'N/A'}</td>
                <td>
                  <button
                    onClick={() => downloadReport(report.id)}
                    style={downloadBtnStyle}
                  >
                    📥 Télécharger PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const btnStyle = {
  padding: '12px 20px',
  marginRight: '12px',
  fontSize: '16px',
  cursor: 'pointer',
  border: 'none',
  borderRadius: '6px',
  background: '#3b82f6',
  color: 'white',
};

const downloadBtnStyle = {
  padding: '8px 16px',
  background: '#14b8a6',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
};

export default ReporterTest;

