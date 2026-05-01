"""
sender.py
─────────
Envoie les données Veeam vers le microservice collector toutes les 5s.
Remplace collect_veeam_data() par ta vraie logique de collecte.
"""

import time
import requests
from datetime import datetime

# ← L'URL de ton microservice dans Minikube (NodePort)
#   kubectl get svc veeam-collector -n default  → récupère le port
INGEST_URL = "http://<MINIKUBE_IP>:<NODE_PORT>/ingest"

INTERVAL = 5  # secondes


def collect_veeam_data() -> dict:
    """
    ← Remplace par ta vraie collecte depuis ton serveur Veeam.
    Retourne le payload tel quel.
    """
    return {
        "time": str(datetime.now()),
        "veeam": {
            "failed_sessions": [
                {"JobName": "Backup Job 5", "EndTime": "2026-04-24 17:41:10", "Result": "Failed"},
                {"JobName": "Backup Job 3", "EndTime": "2026-04-24 16:28:35", "Result": "Failed"},
            ],
            "collected_at": str(datetime.now()),
            "jobs": {
                "Name": "Backup Job all",
                "State": "Working",
                "LastResult": "None",
                "IsRunning": True,
                "Type": "Backup"
            },
            "running_sessions": {
                "JobName": "Backup Job all",
                "StartTime": "2026-04-24 17:42:47",
                "Progress": 85,
                "State": "Working"
            }
        }
    }


def send(payload: dict):
    try:
        r = requests.post(INGEST_URL, json=payload, timeout=5)
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✓ {r.status_code}")
    except Exception as e:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] ✗ {e}")


if __name__ == "__main__":
    print(f"Envoi vers {INGEST_URL} toutes les {INTERVAL}s — Ctrl+C pour arrêter")
    while True:
        send(collect_veeam_data())
        time.sleep(INTERVAL)
