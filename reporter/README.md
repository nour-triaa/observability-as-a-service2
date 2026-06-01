# ESXi Reporter — Guide de Déploiement

## 📦 Structure
```
reporter/
├── app/
│   ├── main.py                  # FastAPI + lifespan
│   ├── config.py                # Settings Pydantic
│   ├── scheduler.py             # APScheduler 12h + purge 30j
│   ├── collectors/
│   │   ├── prometheus.py        # Métriques VMware ESXi
│   │   ├── loki.py              # Logs Loki + Alertes Signoz
│   │   └── veeam.py             # Backups Veeam
│   ├── engine/
│   │   └── correlator.py        # Moteur de corrélation intelligent
│   ├── generator/
│   │   └── pdf_builder.py       # PDF ReportLab + Matplotlib
│   └── storage/
│       └── db.py                # SQLAlchemy async + PostgreSQL
├── k8s/
│   ├── reporter-configmap.yaml
│   ├── reporter-secret.yaml
│   ├── reporter-pvc.yaml
│   ├── reporter-deployment.yaml
│   ├── reporter-service.yaml
│   └── reporter-ingress.yaml
├── Dockerfile
└── requirements.txt
```

---

## 🚀 Déploiement sur Minikube

### 1. Build de l'image Docker
```bash
# Se connecter au registry Docker de minikube
eval $(minikube docker-env)

# Build l'image
docker build -t reporter:latest .
```

### 2. Créer le namespace (si pas déjà créé)
```bash
kubectl create namespace monitoring
```

### 3. Appliquer les manifests K8s dans l'ordre
```bash
kubectl apply -f k8s/reporter-configmap.yaml
kubectl apply -f k8s/reporter-secret.yaml
kubectl apply -f k8s/reporter-pvc.yaml
kubectl apply -f k8s/reporter-deployment.yaml
kubectl apply -f k8s/reporter-service.yaml
kubectl apply -f k8s/reporter-ingress.yaml
```

### 4. Activer l'Ingress sur Minikube
```bash
minikube addons enable ingress
```

### 5. Ajouter au /etc/hosts (Linux/Mac)
```bash
echo "$(minikube ip) reporter.local" | sudo tee -a /etc/hosts
```

### 6. Vérifier le déploiement
```bash
kubectl get all -n monitoring -l app=reporter
kubectl logs -n monitoring deployment/reporter-deployment -f
```

---

## 🌐 API Endpoints

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/health` | Healthcheck |
| GET | `/ready` | Readiness probe K8s |
| GET | `/api/reports` | Liste des rapports (`?limit=20&offset=0`) |
| GET | `/api/reports/{id}` | Détail d'un rapport |
| GET | `/api/reports/{id}/download` | **Télécharger le PDF** |
| POST | `/api/reports/generate` | Générer un rapport maintenant |
| POST | `/api/reports/purge` | Purge manuelle (> 30j) |
| GET | `/api/scheduler/status` | Statut du scheduler |

### Exemples curl
```bash
# Lister les rapports
curl http://reporter.local/api/reports

# Télécharger rapport ID 1
curl -O http://reporter.local/api/reports/1/download

# Déclencher un rapport immédiat
curl -X POST http://reporter.local/api/reports/generate

# Via NodePort (si pas d'Ingress)
curl http://$(minikube ip):30880/api/reports
```

---

## ⚛️ Intégration React Dashboard

```javascript
const REPORTER_API = "http://reporter.local"; // ou http://<minikube-ip>:30880

// Lister les rapports
const fetchReports = async () => {
  const res = await fetch(`${REPORTER_API}/api/reports?limit=20`);
  const data = await res.json();
  return data.reports;
};

// Télécharger un rapport
const downloadReport = (reportId, filename) => {
  const link = document.createElement("a");
  link.href = `${REPORTER_API}/api/reports/${reportId}/download`;
  link.download = filename;
  link.click();
};

// Générer un rapport maintenant
const generateNow = async () => {
  await fetch(`${REPORTER_API}/api/reports/generate`, { method: "POST" });
};
```

---

## ⚙️ Configuration

Modifier `k8s/reporter-configmap.yaml` pour adapter les URLs :
- `PROMETHEUS_URL` — URL Prometheus
- `LOKI_URL` — URL Loki  
- `SIGNOZ_ALERTS_URL` — URL Signoz
- `VEEAM_URL` — URL Veeam Collector
- `RETENTION_DAYS` — Rétention (défaut: 30j)
- `REPORT_INTERVAL_HOURS` — Fréquence (défaut: 12h)

---

## 📊 Contenu du rapport PDF

1. **Page de couverture** — Score santé global, résumé exécutif
2. **Résumé Exécutif** — KPIs + tableau des insights
3. **Infrastructure ESXi** — Host, Datastore, VMs + graphes CPU/RAM
4. **Sauvegardes Veeam** — SLA, RPO, RTO, statut jobs + graphes
5. **Logs & Alertes** — Erreurs, warnings, critiques + top erreurs
6. **Corrélations** — Analyse intelligente cross-sources

---

## 🗂️ Nom des fichiers rapport

Format : `report_YYYY-MM-DD_HH-MM.pdf`  
Exemple : `report_2026-05-18_14-00.pdf`
