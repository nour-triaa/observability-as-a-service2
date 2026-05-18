// src/pages/ReporterTest.jsx
import { useState, useEffect } from 'react';  // ← useEffect ajouté

const BASE_URL = 'http://reporter.local';

function ReporterTest() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [generating, setGenerating] = useState(false);

  // ✅ Fix 2 : chargement automatique au montage du composant
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

      // ✅ Fix 1 : normaliser peu importe le format retourné par l'API
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
      setMessage('🚀 Rapport demandé avec succès !');
      await fetchReports(); // ✅ Bonus : rafraîchit la liste automatiquement après génération
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

  // ... reste du JSX identique
