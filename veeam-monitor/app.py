from flask import Flask, jsonify, request
from flask_cors import CORS
from datetime import datetime, timezone

app = Flask(__name__)
CORS(app)

# Dernier payload reçu
latest_data = {}
received_at = None


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/ingest", methods=["POST"])
def ingest():
    """Reçoit les données du script Python."""
    global latest_data, received_at
    payload = request.get_json(silent=True)
    if not payload:
        return jsonify({"error": "Invalid JSON"}), 400
    latest_data = payload
    received_at = datetime.now(timezone.utc).isoformat()
    return jsonify({"ok": True, "received_at": received_at}), 200


@app.route("/data", methods=["GET"])
def get_data():
    """
    Retourne le payload complet enrichi :
    - payload brut
    - jobs formatés avec RPO/RTO/SLA/progression
    - résumé global calculé sur tous les jobs
    """
    if not latest_data:
        return jsonify({"error": "No data yet"}), 404

    veeam = latest_data.get("veeam", {})
    jobs_raw = veeam.get("jobs", [])

    # ── Formatage de chaque job ──────────────────────────────────────────────
    jobs_out = []
    for j in jobs_raw:
        progress = None
        if j.get("is_running"):
            progress = {
                "pct":          j.get("progress_pct", 0),
                "processed_gb": j.get("processed_gb"),
                "total_gb":     j.get("total_gb"),
                "speed_mbs":    j.get("speed_mbs"),
                "eta":          j.get("eta", ""),
            }

        rpo_min   = j.get("rpo_minutes")
        rto_min   = j.get("rto_minutes")
        sla_pct   = j.get("sla_30d_pct")
        sla_ok    = j.get("sla_rpo_compliant", 0)
        sla_total = j.get("sla_total_sessions", 0)
        sla_failed = j.get("sla_failed", 0)

        last_failed  = j.get("last_failed_time", "") or ""
        last_success = j.get("last_success_time", "") or ""

        jobs_out.append({
            "job_name":   j.get("job_name"),
            "type":       j.get("type"),
            "repository": j.get("repository"),
            # ── État ─────────────────────────────────────────────
            "state":          j.get("state"),
            "last_result":    j.get("last_result"),
            "is_running":     j.get("is_running", False),
            "session_state":  j.get("session_state"),
            "session_result": j.get("session_result"),
            # ── Timestamps ───────────────────────────────────────
            "start_time":        j.get("start_time"),
            "end_time":          j.get("end_time"),
            "last_point":        j.get("last_point"),
            "last_success_time": last_success if last_success else None,
            "last_failed_time":  last_failed  if last_failed  else None,
            "has_failed_recently": bool(last_failed),
            # ── Progression ──────────────────────────────────────
            "progress": progress,
            # ── RPO ──────────────────────────────────────────────
            "rpo": {
                "minutes":   rpo_min,
                "human":     _fmt_minutes(rpo_min),
                "source":    j.get("rpo_source", ""),
                "compliant": rpo_min is not None,
            },
            # ── RTO ──────────────────────────────────────────────
            "rto": {
                "minutes": rto_min,
                "human":   _fmt_minutes(rto_min),
            },
            # ── SLA 30 jours ─────────────────────────────────────
            "sla_30d": {
                "pct":            sla_pct,
                "compliant_runs": sla_ok,
                "failed_runs":    sla_failed,
                "total_sessions": sla_total,
            },
        })

    global_summary = _compute_global(jobs_raw) if jobs_raw else {}

    return jsonify({
        "received_at":  received_at,
        "collected_at": veeam.get("collected_at"),
        "global":       global_summary,
        "jobs":         jobs_out,
        "job_count":    len(jobs_out),
        "payload":      latest_data,   # payload brut conservé
    }), 200


# ── Helpers ──────────────────────────────────────────────────────────────────

def _fmt_minutes(minutes):
    if minutes is None:
        return None
    minutes = int(minutes)
    days  = minutes // 1440
    hours = (minutes % 1440) // 60
    mins  = minutes % 60
    parts = []
    if days:  parts.append(f"{days}j")
    if hours: parts.append(f"{hours}h")
    parts.append(f"{mins}m")
    return " ".join(parts)


def _compute_global(jobs):
    rpo_values = [j["rpo_minutes"] for j in jobs if j.get("rpo_minutes") is not None]
    rto_values = [j["rto_minutes"] for j in jobs if j.get("rto_minutes") is not None]

    total_sessions  = sum(j.get("sla_total_sessions", 0) for j in jobs)
    total_compliant = sum(j.get("sla_rpo_compliant",  0) for j in jobs)
    total_failed    = sum(j.get("sla_failed",         0) for j in jobs)

    sla_pct   = round(total_compliant / total_sessions * 100, 1) if total_sessions else None
    rpo_worst = max(rpo_values) if rpo_values else None
    rto_avg   = round(sum(rto_values) / len(rto_values), 1) if rto_values else None

    jobs_running = [j["job_name"] for j in jobs if j.get("is_running")]
    jobs_ok      = [j["job_name"] for j in jobs
                    if not j.get("is_running") and j.get("last_result") == "Success"]
    jobs_ko      = [j["job_name"] for j in jobs
                    if not j.get("is_running") and j.get("last_result") == "Failed"]

    return {
        "rpo_worst_minutes": rpo_worst,
        "rpo_worst_human":   _fmt_minutes(rpo_worst),
        "rto_avg_minutes":   rto_avg,
        "rto_avg_human":     _fmt_minutes(int(rto_avg)) if rto_avg is not None else None,
        "sla_pct":           sla_pct,
        "total_sessions_30d":  total_sessions,
        "total_compliant_30d": total_compliant,
        "total_failed_30d":    total_failed,
        "jobs_running":  jobs_running,
        "jobs_ok":       jobs_ok,
        "jobs_failed":   jobs_ko,
        "count_running": len(jobs_running),
        "count_ok":      len(jobs_ok),
        "count_failed":  len(jobs_ko),
    }


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050)
