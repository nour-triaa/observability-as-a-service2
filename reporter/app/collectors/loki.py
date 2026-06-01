import httpx
import logging
from datetime import datetime, timedelta
from collections import Counter
from app.config import settings

logger = logging.getLogger(__name__)


class LokiCollector:

    def __init__(self):
        self.base_url = settings.LOKI_URL
        self.timeout = 15.0

    async def query_logs(self, query: str, hours: int = 12, limit: int = 500) -> list:
        try:
            end = datetime.utcnow()
            start = end - timedelta(hours=hours)
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(f"{self.base_url}/query_range", params={
                    "query": query,
                    "start": int(start.timestamp() * 1e9),
                    "end": int(end.timestamp() * 1e9),
                    "limit": limit,
                    "direction": "backward"
                })
                resp.raise_for_status()
                data = resp.json()
                results = data.get("data", {}).get("result", [])
                logs = []
                for stream in results:
                    labels = stream.get("stream", {})
                    for ts, line in stream.get("values", []):
                        logs.append({
                            "timestamp": datetime.utcfromtimestamp(int(ts) / 1e9).isoformat(),
                            "message": line,
                            "labels": labels
                        })
                return logs
        except Exception as e:
            logger.error(f"[Loki] query error: {e}")
            return []

    async def collect_all(self) -> dict:
        logger.info("[Loki] Collecting logs...")

        # Collect errors and warnings
        error_logs = await self.query_logs('{job=~".+"} |= "error"', hours=12)
        warn_logs = await self.query_logs('{job=~".+"} |= "warn"', hours=12)
        critical_logs = await self.query_logs('{job=~".+"} |= "critical"', hours=12)
        all_logs = await self.query_logs('{job=~".+"}', hours=12, limit=1000)

        # Top error messages
        error_messages = [l["message"][:120] for l in error_logs]
        top_errors = Counter(error_messages).most_common(10)

        # Error timeline per hour
        timeline = {}
        for log in error_logs:
            try:
                hour = log["timestamp"][:13]  # YYYY-MM-DDTHH
                timeline[hour] = timeline.get(hour, 0) + 1
            except:
                pass

        return {
            "total_logs": len(all_logs),
            "total_errors": len(error_logs),
            "total_warnings": len(warn_logs),
            "total_critical": len(critical_logs),
            "top_errors": [{"message": msg, "count": cnt} for msg, cnt in top_errors],
            "error_timeline": timeline,
            "recent_critical": critical_logs[:20],
            "recent_errors": error_logs[:30]
        }


class SignozCollector:

    def __init__(self):
        self.url = settings.SIGNOZ_ALERTS_URL
        self.timeout = 15.0

    async def get_alerts(self) -> list:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.url)
                resp.raise_for_status()
                return resp.json() if isinstance(resp.json(), list) else resp.json().get("alerts", [])
        except Exception as e:
            logger.error(f"[Signoz] alerts error: {e}")
            return []

    async def collect_all(self) -> dict:
        logger.info("[Signoz] Collecting alerts...")
        alerts = await self.get_alerts()

        firing = [a for a in alerts if a.get("state") == "firing"]
        resolved = [a for a in alerts if a.get("state") == "resolved"]

        severity_count = Counter(a.get("labels", {}).get("severity", "unknown") for a in alerts)

        return {
            "total_alerts": len(alerts),
            "firing": len(firing),
            "resolved": len(resolved),
            "by_severity": dict(severity_count),
            "firing_alerts": firing[:20],
            "all_alerts": alerts[:50]
        }
