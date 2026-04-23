"""
================================================
  VMware Observability ML Microservice
  Flask API — Anomaly Detection
  Sources: Prometheus + Loki
================================================
"""
 
from flask import Flask, jsonify, request
from flask_cors import CORS
import logging
 
from collector import PrometheusCollector
from loki_collector import LokiCollector
from analyzer import MLAnalyzer
 
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)
 
app = Flask(__name__)
CORS(app)
 
prom   = PrometheusCollector()
loki   = LokiCollector()
ml     = MLAnalyzer()
 
 
# ─────────────────────────────────────────────
#  HEALTH
# ─────────────────────────────────────────────
 
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "vmware-ml-analyzer"}), 200
 
 
# ─────────────────────────────────────────────
#  ANALYSE COMPLÈTE D'UNE VM
# ─────────────────────────────────────────────
 
@app.route("/api/v1/analyze/<vm_name>", methods=["GET"])
def analyze_vm(vm_name):
    """
    Analyse complète d'une VM : métriques Prometheus + logs Loki → ML
    Query params:
      - window  : fenêtre temporelle en minutes (défaut: 30)
      - step    : pas de scraping en secondes (défaut: 60)
    """
    window_min = int(request.args.get("window", 30))
    step_sec   = int(request.args.get("step", 60))
 
    try:
        # 1. Collecte Prometheus
        log.info(f"[{vm_name}] Collecte Prometheus ({window_min}min)...")
        prom_data = prom.fetch_vm_metrics(vm_name, window_min, step_sec)
 
        # 2. Collecte Loki
        log.info(f"[{vm_name}] Collecte Loki ({window_min}min)...")
        loki_features = loki.fetch_log_features(vm_name, window_min)
 
        # 3. Fusion + Analyse ML
        log.info(f"[{vm_name}] Analyse ML...")
        result = ml.analyze(vm_name, prom_data, loki_features)
 
        return jsonify(result), 200
 
    except Exception as e:
        log.error(f"[{vm_name}] Erreur: {e}")
        return jsonify({"error": str(e), "vm": vm_name}), 500
 
 
# ─────────────────────────────────────────────
#  LISTE DES VMs ANOMALES
# ─────────────────────────────────────────────
 
@app.route("/api/v1/anomalies", methods=["GET"])
def list_anomalies():
    """
    Retourne toutes les VMs avec anomalies détectées (fenêtre 15min)
    """
    window_min = int(request.args.get("window", 15))
    vms = request.args.get("vms", "").split(",") if request.args.get("vms") else []
 
    results = []
    for vm_name in vms:
        if not vm_name.strip():
            continue
        try:
            prom_data     = prom.fetch_vm_metrics(vm_name.strip(), window_min, 60)
            loki_features = loki.fetch_log_features(vm_name.strip(), window_min)
            result        = ml.analyze(vm_name.strip(), prom_data, loki_features)
            if result.get("anomaly_detected"):
                results.append(result)
        except Exception as e:
            log.warning(f"Skip {vm_name}: {e}")
 
    return jsonify({"anomalies": results, "count": len(results)}), 200
 
 
# ─────────────────────────────────────────────
#  SCORE TEMPS RÉEL (dernière valeur uniquement)
# ─────────────────────────────────────────────
 
@app.route("/api/v1/score/<vm_name>", methods=["GET"])
def realtime_score(vm_name):
    """
    Score d'anomalie sur les 5 dernières minutes — pour polling fréquent
    """
    try:
        prom_data     = prom.fetch_vm_metrics(vm_name, window_min=5, step_sec=30)
        loki_features = loki.fetch_log_features(vm_name, window_min=5)
        result        = ml.analyze(vm_name, prom_data, loki_features)
 
        return jsonify({
            "vm":              vm_name,
            "anomaly_score":   result.get("anomaly_score"),
            "anomaly_detected": result.get("anomaly_detected"),
            "severity":        result.get("severity"),
            "top_features":    result.get("top_features", []),
        }), 200
 
    except Exception as e:
        return jsonify({"error": str(e)}), 500
 
 
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
