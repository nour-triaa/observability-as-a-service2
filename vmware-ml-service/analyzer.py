"""
================================================
  ML Analyzer — Isolation Forest
  Fenêtre glissante + scoring d'anomalies
================================================
"""

import numpy as np
import pandas as pd
from collections import deque
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from datetime import datetime, timezone

# Fenêtre glissante : on garde les N dernières observations pour entraîner le modèle
WINDOW_SIZE = 200

# Features utilisées par le modèle ML (Prometheus + Loki fusionnées)
ML_FEATURES = [
    # CPU
    "cpu_pct", "cpu_demand", "cpu_ready", "cpu_std", "cpu_max",
    # RAM
    "mem_pct", "mem_swap_kb", "mem_std",
    # Disk
    "disk_used_pct", "disk_latency_ms", "disk_lat_max",
    "disk_read_kbps", "disk_write_kbps",
    # Network
    "net_rx_kbps", "net_tx_kbps", "net_drops",
    # Logs Loki
    "log_error_rate", "log_error_count", "log_critical",
    "log_timeout", "log_oom", "log_restarts", "log_http5xx",
]

# Seuils pour la sévérité humaine
SEVERITY_RULES = [
    ("cpu_pct",        85,  "CPU critique"),
    ("mem_pct",        90,  "RAM critique"),
    ("disk_used_pct",  90,  "Disque plein"),
    ("disk_latency_ms",500, "Latence disque élevée"),
    ("net_drops",      50,  "Paquets réseau perdus"),
    ("log_error_rate", 0.3, "Taux d'erreurs logs élevé"),
    ("log_oom",        1,   "Out-of-Memory détecté"),
    ("log_restarts",   2,   "Redémarrages détectés"),
    ("mem_swap_kb",    500, "Swap actif"),
]


class MLAnalyzer:
    """
    Isolation Forest avec fenêtre glissante par VM.
    Chaque VM a son propre historique et son propre modèle.
    """

    def __init__(self, contamination: float = 0.05):
        self.contamination = contamination
        # Dict vm_name → deque d'observations
        self._windows: dict[str, deque] = {}
        # Dict vm_name → modèle entraîné
        self._models:  dict[str, IsolationForest] = {}
        self._scalers: dict[str, StandardScaler]  = {}

    # ── Fenêtre glissante ──────────────────────────────────────

    def _push(self, vm_name: str, observation: dict):
        if vm_name not in self._windows:
            self._windows[vm_name] = deque(maxlen=WINDOW_SIZE)
        self._windows[vm_name].append(observation)

    def _get_df(self, vm_name: str) -> pd.DataFrame:
        rows = list(self._windows[vm_name])
        df   = pd.DataFrame(rows)
        # S'assurer que toutes les colonnes ML existent
        for f in ML_FEATURES:
            if f not in df.columns:
                df[f] = 0.0
        return df[ML_FEATURES].fillna(0)

    # ── Entraînement / mise à jour du modèle ──────────────────

    def _fit(self, vm_name: str):
        df = self._get_df(vm_name)
        scaler = StandardScaler()
        X      = scaler.fit_transform(df)
        model  = IsolationForest(
            n_estimators=150,
            contamination=self.contamination,
            random_state=42,
        )
        model.fit(X)
        self._models[vm_name]  = model
        self._scalers[vm_name] = scaler

    # ── Scoring ────────────────────────────────────────────────

    def _score(self, vm_name: str, obs: dict) -> tuple[float, bool]:
        """Retourne (score, is_anomaly). Score < 0 = anormal."""
        if vm_name not in self._models:
            return 0.0, False

        scaler = self._scalers[vm_name]
        model  = self._models[vm_name]

        row    = pd.DataFrame([obs])[ML_FEATURES].fillna(0)
        X      = scaler.transform(row)
        score  = float(model.score_samples(X)[0])
        label  = model.predict(X)[0]   # -1 = anomalie, 1 = normal

        return score, label == -1

    # ── Sévérité humaine ───────────────────────────────────────

    def _compute_severity(self, obs: dict, is_anomaly: bool) -> tuple[str, list[str]]:
        triggered = []
        for feat, threshold, label in SEVERITY_RULES:
            val = obs.get(feat, 0)
            if val is not None and val > threshold:
                triggered.append(label)

        if not is_anomaly and not triggered:
            return "normal", []
        if triggered and any("critique" in t or "OOM" in t or "Redémarrage" in t for t in triggered):
            return "critical", triggered
        if is_anomaly or triggered:
            return "warning", triggered
        return "normal", []

    # ── Point d'entrée principal ───────────────────────────────

    def analyze(self, vm_name: str, prom_data: dict, loki_features: dict) -> dict:
        # Fusion des deux sources
        obs = {**prom_data, **loki_features}

        # Mise à jour de la fenêtre glissante
        self._push(vm_name, obs)

        # Réentraîner dès qu'on a assez de données (min 20 points)
        window_len = len(self._windows[vm_name])
        if window_len >= 20:
            self._fit(vm_name)

        # Scoring
        score, is_anomaly = self._score(vm_name, obs)

        # Sévérité
        severity, reasons = self._compute_severity(obs, is_anomaly)

        # Top features les plus déviantes
        top_features = self._top_deviating_features(vm_name, obs)

        return {
            "vm":               vm_name,
            "timestamp":        datetime.now(timezone.utc).isoformat(),
            "anomaly_detected": is_anomaly,
            "anomaly_score":    round(score, 4),
            "severity":         severity,
            "reasons":          reasons,
            "top_features":     top_features,
            "window_size":      window_len,
            "metrics":          {k: obs.get(k) for k in ML_FEATURES},
        }

    def _top_deviating_features(self, vm_name: str, obs: dict, top_n: int = 5) -> list[dict]:
        """Retourne les N features les plus éloignées de leur moyenne historique."""
        if vm_name not in self._windows or len(self._windows[vm_name]) < 5:
            return []

        df    = self._get_df(vm_name)
        means = df.mean()
        stds  = df.std().replace(0, 1)

        deviations = []
        for feat in ML_FEATURES:
            val   = obs.get(feat, 0) or 0
            z     = abs((val - means[feat]) / stds[feat])
            deviations.append({"feature": feat, "value": val, "z_score": round(float(z), 2)})

        deviations.sort(key=lambda x: x["z_score"], reverse=True)
        return deviations[:top_n]
