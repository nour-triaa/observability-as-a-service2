// src/pages/ReporterTest.jsx
import { useState } from 'react';

const BASE_URL = 'http://reporter.local';   // Change si nécessaire

function ReporterTest() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);

  // 1. Lister les rapports
  const fetchReports = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${BASE_URL}/api/reports`);
      if (!res.ok) throw new Error('Erreur lors du chargement');
      const data = await res.json();
      setReports(data);
      setMessage('✅ Rapports chargés avec succès');
    } catch (err) {
      setMessage('❌ Erreur: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. Générer un nouveau rapport
  const generateReport = async () => {
    setGenerating(true);
    setMessage('');
    try {
      const res = await fetch(`${BASE_URL}/api/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Tu peux personnaliser ces données selon ton backend
          title: "Rapport de Test " + new Date().toLocaleDateString(),
          type: "summary",
          generatedBy: "React Test Page"
        }),
      });

      if (!res.ok) throw new Error('Échec de la génération');
      
      setMessage('🚀 Rapport demandé avec succès ! Actualise la liste.');
    } catch (err) {
      setMessage('❌ Erreur génération: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // 3. Télécharger un rapport
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
    <div style={{ padding: '30px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🧪 Test Microservice Reporter</h1>
      <p><strong>Base URL :</strong> {BASE_URL}</p>

      <div style={{ margin: '20px 0' }}>
        <button onClick={fetchReports} disabled={loading} style={btnStyle}>
          {loading ? 'Chargement...' : '📋 Lister les rapports'}
        </button>

        <button onClick={generateReport} disabled={generating} style={{ ...btnStyle, background: '#28a745' }}>
          {generating ? 'Génération...' : '⚡ Générer un nouveau rapport'}
        </button>
      </div>

      {message && (
        <p style={{ padding: '10px', background: '#f0f0f0', borderRadius: '5px' }}>
          {message}
        </p>
      )}

      <h2>Rapports disponibles :</h2>
      {reports.length === 0 ? (
        <p>Aucun rapport trouvé. Clique sur "Lister les rapports"</p>
      ) : (
        <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
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
                  <button onClick={() => downloadReport(report.id)} style={downloadBtnStyle}>
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
  marginRight: '10px',
  fontSize: '16px',
  cursor: 'pointer',
  border: 'none',
  borderRadius: '5px',
  background: '#007bff',
  color: 'white',
};

const downloadBtnStyle = {
  padding: '8px 15px',
  background: '#17a2b8',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
};

export default ReporterTest;
