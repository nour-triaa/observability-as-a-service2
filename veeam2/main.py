from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import sqlite3
import json
import os
from datetime import datetime, timezone

app = FastAPI(title="Veeam2 Backup Control & Observability Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "/data/veeam2.db"

# ──────────────────────────────────────────────
# DATABASE
# ──────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    os.makedirs("/data", exist_ok=True)
    conn = get_db()
    c = conn.cursor()

    # Current command sent by the frontend
    c.execute("""
        CREATE TABLE IF NOT EXISTS command (
            id          INTEGER PRIMARY KEY,
            action      TEXT,
            updated_at  TEXT
        )
    """)

    # Raw data received from the Windows script (progress + logs)
    c.execute("""
        CREATE TABLE IF NOT EXISTS job_data (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            received_at       TEXT NOT NULL,
            job_id            TEXT,
            job_name          TEXT,
            progress          INTEGER,
            status            TEXT,
            transferred_bytes INTEGER,
            speed_bps         INTEGER,
            start_time        TEXT,
            end_time          TEXT,
            restore_point_time TEXT,
            duration_seconds  REAL,
            data_size_bytes   INTEGER,
            retry_count       INTEGER,
            logs              TEXT,
            error_messages    TEXT,
            warning_messages  TEXT,
            raw_data          TEXT
        )
    """)

    # Completed job sessions (used for RPO / RTO / SLA)
    c.execute("""
        CREATE TABLE IF NOT EXISTS job_sessions (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id              TEXT UNIQUE,
            job_name            TEXT,
            start_time          TEXT,
            end_time            TEXT,
            result              TEXT,
            duration_seconds    REAL,
            data_size_bytes     INTEGER,
            restore_point_time  TEXT,
            retry_count         INTEGER,
            error_messages      TEXT
        )
    """)

    # Initialise command row if absent
    c.execute("SELECT COUNT(*) FROM command")
    if c.fetchone()[0] == 0:
        c.execute(
            "INSERT INTO command (id, action, updated_at) VALUES (1, NULL, ?)",
            (datetime.now(timezone.utc).isoformat(),)
        )

    conn.commit()
    conn.close()

init_db()

# ──────────────────────────────────────────────
# MODELS
# ──────────────────────────────────────────────

class ControlRequest(BaseModel):
    action: Optional[str] = None  # "yes" | "no" | null


class JobData(BaseModel):
    """
    Payload sent by the Windows script every polling interval.
    All fields are optional – the script sends what is available.
    """
    job_id:             Optional[str]       = None
    job_name:           Optional[str]       = None
    progress:           Optional[int]       = None   # 0-100 %
    status:             Optional[str]       = None   # running | stopped | success | failed
    transferred_bytes:  Optional[int]       = None
    speed_bps:          Optional[int]       = None   # bytes/s
    start_time:         Optional[str]       = None   # ISO 8601
    end_time:           Optional[str]       = None   # ISO 8601
    restore_point_time: Optional[str]       = None   # ISO 8601
    duration_seconds:   Optional[float]     = None
    data_size_bytes:    Optional[int]       = None
    retry_count:        Optional[int]       = None
    logs:               Optional[List[str]] = []
    error_messages:     Optional[List[str]] = []
    warning_messages:   Optional[List[str]] = []

# ──────────────────────────────────────────────
# HELPERS – CALCULATIONS
# ──────────────────────────────────────────────

def calculate_metrics():
    """Calculate RPO, RTO, SLA from stored sessions."""
    conn = get_db()
    c = conn.cursor()

    c.execute("SELECT * FROM job_sessions ORDER BY start_time DESC LIMIT 30")
    sessions = c.fetchall()

    rpo = rto = sla = None

    if sessions:
        # ── RPO ──────────────────────────────────────────────────────────
        # Time elapsed since the last successful restore point was created.
        c.execute("""
            SELECT restore_point_time FROM job_sessions
            WHERE result = 'success' AND restore_point_time IS NOT NULL
            ORDER BY restore_point_time DESC LIMIT 1
        """)
        row = c.fetchone()
        if row:
            rp_time = datetime.fromisoformat(row["restore_point_time"])
            if rp_time.tzinfo is None:
                rp_time = rp_time.replace(tzinfo=timezone.utc)
            rpo_seconds = (datetime.now(timezone.utc) - rp_time).total_seconds()
            rpo = {
                "value_seconds":      round(rpo_seconds),
                "value_human":        _seconds_to_human(rpo_seconds),
                "last_restore_point": row["restore_point_time"],
            }

        # ── RTO ──────────────────────────────────────────────────────────
        # Average restore / backup duration of successful jobs
        # (approximates how long a restore would take).
        success = [s for s in sessions if s["result"] == "success" and s["duration_seconds"]]
        if success:
            avg = sum(s["duration_seconds"] for s in success) / len(success)
            rto = {
                "average_seconds": round(avg),
                "average_human":   _seconds_to_human(avg),
                "based_on_jobs":   len(success),
            }

        # ── SLA ──────────────────────────────────────────────────────────
        # Success rate over the last 30 jobs.
        total   = len(sessions)
        success_count = len([s for s in sessions if s["result"] == "success"])
        sla = {
            "success_rate_percent": round((success_count / total) * 100, 2),
            "success_count":        success_count,
            "failed_count":         total - success_count,
            "total_jobs":           total,
            "target_percent":       99.0,
            "compliant":            round((success_count / total) * 100, 2) >= 99.0,
        }

    conn.close()
    return rpo, rto, sla


def _seconds_to_human(seconds: float) -> str:
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s   = divmod(rem, 60)
    if h:
        return f"{h}h {m}m {s}s"
    if m:
        return f"{m}m {s}s"
    return f"{s}s"

# ──────────────────────────────────────────────
# ENDPOINTS
# ──────────────────────────────────────────────

@app.get("/veeam2/health")
def health():
    """Health check."""
    return {"status": "ok", "service": "veeam2", "timestamp": datetime.now(timezone.utc).isoformat()}


# ── FRONTEND → MICROSERVICE ───────────────────

@app.post("/veeam2/control")
def set_control(request: ControlRequest):
    """
    Frontend sends the desired action.
    - action = "yes"  → start the backup job
    - action = "no"   → stop  the backup job
    - action = null   → no change (idle)
    """
    if request.action not in ("yes", "no", None):
        raise HTTPException(status_code=400, detail="action must be 'yes', 'no', or null")

    conn = get_db()
    conn.execute(
        "UPDATE command SET action = ?, updated_at = ? WHERE id = 1",
        (request.action, datetime.now(timezone.utc).isoformat())
    )
    conn.commit()
    conn.close()

    return {
        "success": True,
        "action":  request.action,
        "message": f"Command set to: {request.action}",
    }


@app.get("/veeam2/status")
def get_status():
    """
    Frontend polls this endpoint (every 5-15 s).
    Returns current command, live job state, traces, RPO, RTO, SLA.
    """
    conn = get_db()

    cmd = conn.execute("SELECT action, updated_at FROM command WHERE id = 1").fetchone()

    latest = conn.execute(
        "SELECT * FROM job_data ORDER BY received_at DESC LIMIT 1"
    ).fetchone()

    recent_rows = conn.execute(
        "SELECT received_at, logs, error_messages, warning_messages FROM job_data ORDER BY received_at DESC LIMIT 30"
    ).fetchall()

    conn.close()

    rpo, rto, sla = calculate_metrics()

    current_job = None
    traces       = []

    if latest:
        current_job = {
            "job_id":            latest["job_id"],
            "job_name":          latest["job_name"],
            "status":            latest["status"],
            "progress":          latest["progress"],
            "transferred_bytes": latest["transferred_bytes"],
            "speed_bps":         latest["speed_bps"],
            "start_time":        latest["start_time"],
            "end_time":          latest["end_time"],
            "duration_seconds":  latest["duration_seconds"],
            "last_update":       latest["received_at"],
        }

        for row in reversed(recent_rows):
            for field in ("logs", "error_messages", "warning_messages"):
                try:
                    entries = json.loads(row[field]) if row[field] else []
                except Exception:
                    entries = []
                for entry in entries:
                    traces.append({"timestamp": row["received_at"], "level": field, "message": entry})

    return {
        "command":     cmd["action"] if cmd else None,
        "current_job": current_job,
        "traces":      traces[-100:],  # last 100 lines
        "rpo":         rpo,
        "rto":         rto,
        "sla":         sla,
    }


# ── WINDOWS SCRIPT → MICROSERVICE ────────────

@app.get("/veeam2/command")
def get_command():
    """
    Windows script polls this every 5-15 s to know what to do.
    Returns the current command and resets it to null after delivery.
    """
    conn = get_db()
    row = conn.execute("SELECT action, updated_at FROM command WHERE id = 1").fetchone()

    command = row["action"] if row else None

    # Auto-reset to null after delivery so the action is not repeated
    if command in ("yes", "no"):
        conn.execute(
            "UPDATE command SET action = NULL, updated_at = ? WHERE id = 1",
            (datetime.now(timezone.utc).isoformat(),)
        )
        conn.commit()

    conn.close()
    return {"command": command, "updated_at": row["updated_at"] if row else None}


@app.post("/veeam2/data")
def receive_job_data(data: JobData):
    """
    Windows script posts job telemetry here every polling interval.
    Stores progress + logs, and archives completed sessions for metrics.
    """
    conn = get_db()

    conn.execute("""
        INSERT INTO job_data (
            received_at, job_id, job_name, progress, status,
            transferred_bytes, speed_bps, start_time, end_time,
            restore_point_time, duration_seconds, data_size_bytes,
            retry_count, logs, error_messages, warning_messages, raw_data
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        datetime.now(timezone.utc).isoformat(),
        data.job_id, data.job_name, data.progress, data.status,
        data.transferred_bytes, data.speed_bps,
        data.start_time, data.end_time, data.restore_point_time,
        data.duration_seconds, data.data_size_bytes, data.retry_count,
        json.dumps(data.logs),
        json.dumps(data.error_messages),
        json.dumps(data.warning_messages),
        data.model_dump_json(),
    ))

    # Archive completed session
    if data.status in ("success", "failed", "stopped") and data.start_time and data.end_time:
        conn.execute("""
            INSERT OR IGNORE INTO job_sessions (
                job_id, job_name, start_time, end_time, result,
                duration_seconds, data_size_bytes, restore_point_time,
                retry_count, error_messages
            ) VALUES (?,?,?,?,?,?,?,?,?,?)
        """, (
            data.job_id, data.job_name,
            data.start_time, data.end_time,
            data.status,
            data.duration_seconds, data.data_size_bytes,
            data.restore_point_time, data.retry_count,
            json.dumps(data.error_messages),
        ))

    conn.commit()
    conn.close()

    return {"success": True, "received_at": datetime.now(timezone.utc).isoformat()}


# ── HISTORY ──────────────────────────────────

@app.get("/veeam2/history")
def get_history(limit: int = 50):
    """Returns the last N completed job sessions."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM job_sessions ORDER BY start_time DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return {"sessions": [dict(r) for r in rows]}
