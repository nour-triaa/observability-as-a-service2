# ai-analyzer — Microservice IA pour l'Observabilité

## Stack
- **Modèle IA** : `llama-3.1-8b-instant` via Groq API (gratuit)
- **Framework** : FastAPI + Uvicorn
- **Déploiement** : Minikube / Kubernetes

---

## 🚀 Déploiement pas-à-pas

### 1. Récupérer ta clé Groq gratuite
→ https://console.groq.com → "Create API Key"

### 2. Mettre ta clé dans le secret
```bash
# Édite k8s/secret.yaml et remplace "ta_clé_groq_ici" par ta vraie clé
```

### 3. Builder l'image Docker dans Minikube
```bash
eval $(minikube docker-env)
docker build -t ai-analyzer:latest .
```

### 4. Créer le namespace si besoin
```bash
kubectl create namespace observability
```

### 5. Déployer tous les fichiers
```bash
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

### 6. Vérifier que le pod tourne
```bash
kubectl get pods -n observability
kubectl logs -f deployment/ai-analyzer -n observability
```

---

## 📡 Endpoints disponibles

| Méthode | URL | Description |
|---------|-----|-------------|
| GET  | `/health` | Healthcheck |
| POST | `/analyze/logs` | Analyse des logs |
| POST | `/analyze/metrics` | Analyse des métriques |
| POST | `/analyze/alert` | Analyse d'une alerte Prometheus |
| POST | `/analyze/full` | Analyse combinée logs + métriques |

---

## 🧪 Test rapide depuis un autre pod

```bash
# Port-forward pour tester en local
kubectl port-forward svc/ai-analyzer-service 8000:8000 -n observability

# Test de l'endpoint logs
curl -X POST http://localhost:8000/analyze/logs \
  -H "Content-Type: application/json" \
  -d '{
    "logs": "ERROR: Connection refused to database\nERROR: Timeout after 30s\nCRITICAL: Service unhealthy",
    "service_name": "payment-service",
    "namespace": "production"
  }'
```

---

## 🔗 Appel depuis un autre microservice

```python
import requests

response = requests.post(
    "http://ai-analyzer-service:8000/analyze/alert",
    json={
        "alert_name": "HighCPUUsage",
        "alert_message": "CPU > 90% for 5 minutes",
        "labels": {"service": "auth-service", "env": "prod"},
        "logs": "..."
    }
)
print(response.json())
```
