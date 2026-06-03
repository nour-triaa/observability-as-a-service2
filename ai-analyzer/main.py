from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from groq import Groq
from typing import Optional
import os
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Analyzer — Observability Service",
    description="Microservice IA pour l'analyse intelligente de logs et métriques",
    version="1.0.0"
)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

SYSTEM_PROMPT = """ Tu es un expert SRE (Site Reliability Engineer) spécialisé en observabilité et supervision d'infrastructures virtuelles.
Ton rôle est d'analyser les métriques d'un hyperviseur VMware ESXi ainsi que celles des machines virtuelles qu'il héberge afin d'évaluer l'état de santé de l'infrastructure et d'identifier d'éventuelles anomalies.
""".

Pour chaque analyse, tu dois :
1. Détecter les anomalies ou erreurs présentes
2. Identifier la root cause probable
3. Évaluer le niveau de sévérité (CRITICAL / HIGH / MEDIUM / LOW)
4. Proposer des actions correctives concrètes
5. Donner une analyse sur la situation de l'hyperviseur
6. Réaliser une analyse par VM : identification des problèmes spécifiques à chaque VM, corrélation des métriques (CPU, mémoire, disque, réseau, ready time, etc.) et propositions de solutions ciblées par VM
7.Tu dois produire des réponses riches, détaillées, professionnelles et actionnables. Évite les recommandations génériques. Utilise les métriques fournies pour justifier chaque conclusion.
8.Propositions de solutions ciblées et actions concrètes pour chaque  séparément VM 
9.Produire des recommandations ACTIONNABLES :
   Les recommandations doivent :
   - être concrètes
   - être techniques
   - inclure commandes, configurations ou opérations si pertinent
   - être priorisées :
     - immédiates
     - court terme
     - long terme
10. Corrélation des métriques

Toujours corréler les métriques entre elles.

Exemples de corrélation dans un environnement VMware :

- CPU usage élevé + CPU Ready élevé
  => contention CPU sur l’hyperviseur

- faible CPU usage + Ready Time élevé
  => surallocation vCPU probable

- mémoire élevée + swap actif
  => manque RAM physique

- ballooning mémoire détecté
  => pression mémoire sur ESXi

- datastore latency élevée + IOPS élevés
  => saturation stockage

- réseau élevé + packet loss
  => congestion réseau

- plusieurs VMs lentes simultanément
  => problème hyperviseur ou datastore partagé

- VM powered off + dépendances critiques
  => risque de service indisponible


Réponds toujours en JSON structuré avec les champs :
- anomaly_detected (bool)
- severity (string)
- summary (string)
- root_cause (string)
- recommendations (list of strings)
- confidence_score (float 0-1)
"""


# ---------- Schemas ----------

class LogAnalysisRequest(BaseModel):
    logs: str
    service_name: Optional[str] = "unknown"
    namespace: Optional[str] = "default"

class MetricAnalysisRequest(BaseModel):
    metrics: dict
    service_name: Optional[str] = "unknown"
    threshold_cpu: Optional[float] = 80.0
    threshold_memory: Optional[float] = 85.0

class AlertAnalysisRequest(BaseModel):
    alert_name: str
    alert_message: str
    labels: Optional[dict] = {}
    logs: Optional[str] = ""


# ---------- Helper ----------

def call_llm(user_prompt: str) -> dict:
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": user_prompt}
            ],
            temperature=0.2,
            max_tokens=1024,
            response_format={"type": "json_object"}
        )
        import json
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.error(f"LLM call failed: {e}")
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")


# ---------- Endpoints ----------

@app.get("/health")
def health():
    return {"status": "ok", "model": "llama-3.1-8b-instant", "provider": "groq"}


@app.post("/analyze/logs")
def analyze_logs(req: LogAnalysisRequest):
    """Analyse intelligente des logs d'un service"""
    prompt = f"""
Analyse les logs suivants du service '{req.service_name}' (namespace: {req.namespace}).

LOGS:
{req.logs}

Identifie les anomalies, erreurs critiques et propose une root cause analysis.
"""
    result = call_llm(prompt)
    result["service"] = req.service_name
    result["namespace"] = req.namespace
    logger.info(f"Log analysis done for {req.service_name} — severity: {result.get('severity')}")
    return result


@app.post("/analyze/metrics")
def analyze_metrics(req: MetricAnalysisRequest):
    """Analyse des métriques système (CPU, RAM, latence...)"""
    prompt = f"""
Analyse les métriques suivantes du service '{req.service_name}'.
Seuils configurés : CPU > {req.threshold_cpu}%, Memory > {req.threshold_memory}%

MÉTRIQUES:
{req.metrics}

Détecte les anomalies de performance et propose des recommandations.
"""
    result = call_llm(prompt)
    result["service"] = req.service_name
    logger.info(f"Metrics analysis done for {req.service_name}")
    return result


@app.post("/analyze/alert")
def analyze_alert(req: AlertAnalysisRequest):
    """Analyse d'une alerte Prometheus et génère une explication + plan d'action"""
    prompt = f"""
Une alerte Prometheus vient d'être déclenchée.

Nom de l'alerte : {req.alert_name}
Message         : {req.alert_message}
Labels          : {req.labels}
Logs associés   : {req.logs if req.logs else "Aucun log fourni"}

Analyse cette alerte, identifie la root cause et fournis un plan d'action prioritaire.
"""
    result = call_llm(prompt)
    result["alert_name"] = req.alert_name
    logger.info(f"Alert analysis done: {req.alert_name} — severity: {result.get('severity')}")
    return result


@app.post("/analyze/full")
def full_analysis(logs: str, metrics: dict, service_name: str = "unknown"):
    """Analyse complète : logs + métriques combinés"""
    prompt = f"""
Analyse complète du service '{service_name}'.

LOGS:
{logs}

MÉTRIQUES:
{metrics}

Fournis une analyse corrélée des logs et métriques pour identifier la root cause globale.
"""
    return call_llm(prompt)
