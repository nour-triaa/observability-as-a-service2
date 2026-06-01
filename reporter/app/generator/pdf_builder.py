import io
import os
import logging
from datetime import datetime
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.gridspec as gridspec
from matplotlib.patches import FancyBboxPatch
import numpy as np

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, HRFlowable, KeepTogether
)
from reportlab.graphics.shapes import Drawing, Rect, String

try:
    from app.config import settings
    REPORTS_DIR = settings.REPORTS_DIR
except ImportError:
    REPORTS_DIR = "/tmp/reports"

logger = logging.getLogger(__name__)

# ─── Color Palette ──────────────────────────────────────────────────────────
C_BLUE_DARK    = colors.HexColor("#1a2744")
C_BLUE_MED     = colors.HexColor("#2563eb")
C_BLUE_LIGHT   = colors.HexColor("#dbeafe")
C_GREEN        = colors.HexColor("#16a34a")
C_GREEN_LIGHT  = colors.HexColor("#dcfce7")
C_RED          = colors.HexColor("#dc2626")
C_RED_LIGHT    = colors.HexColor("#fee2e2")
C_ORANGE       = colors.HexColor("#ea580c")
C_ORANGE_LIGHT = colors.HexColor("#ffedd5")
C_YELLOW       = colors.HexColor("#ca8a04")
C_YELLOW_LIGHT = colors.HexColor("#fef9c3")
C_GRAY_LIGHT   = colors.HexColor("#f8fafc")
C_GRAY         = colors.HexColor("#64748b")
C_BORDER       = colors.HexColor("#e2e8f0")
C_WHITE        = colors.white
C_PURPLE       = colors.HexColor("#7c3aed")


def _health_color(label: str):
    return {
        "HEALTHY":  C_GREEN,
        "WARNING":  C_YELLOW,
        "DEGRADED": C_ORANGE,
        "CRITICAL": C_RED,
    }.get(label, C_GRAY)


def _severity_color(level: str):
    return {
        "CRITICAL": C_RED,
        "WARNING":  C_YELLOW,
        "OK":       C_GREEN,
        "INFO":     C_BLUE_MED,
        "HIGH":     C_ORANGE,
    }.get(level, C_GRAY)


def _pct_color(pct: float, warn: float = 70, crit: float = 90) -> str:
    if pct >= crit:
        return "#dc2626"
    if pct >= warn:
        return "#ea580c"
    return "#16a34a"


# ─── Helpers de normalisation ────────────────────────────────────────────────

def _safe_pct_values(values: list) -> list:
    if not values:
        return []
    needs_norm = any(v > 100 for v in values)
    result = []
    for v in values:
        val = round(v / 100, 2) if needs_norm else round(v, 2)
        result.append(min(max(val, 0.0), 100.0))
    return result


def _mb_to_pct(values: list, mem_max_mb: float) -> list:
    if not values or mem_max_mb <= 0:
        return []
    return [min(max(round((v / mem_max_mb) * 100, 2), 0.0), 100.0) for v in values]


# ─── Source unique pour le comptage VMs ─────────────────────────────────────

def _count_powered_on(vms: dict) -> int:
    """
    FIX CENTRAL — unique fonction autorisée pour compter les VMs allumées.
    Ne jamais lire cette valeur depuis analysis (LLM), qui peut être désynchronisé.
    """
    return sum(1 for v in vms.values() if v.get("power_state") == "poweredOn")


# ─── Filtre insights LLM ────────────────────────────────────────────────────

# Catégories couvertes par les insights live (prometheus direct).
# Tout insight LLM dont la catégorie contient un de ces mots-clés
# est supprimé pour éviter les doublons et les valeurs désynchronisées.
_LIVE_TOPICS = {
    "vm", "vms", "cpu", "ram", "mem", "memoire", "mémoire", "memory",
    "datastore", "disque", "disk", "alerte", "alertes", "alert", "alerts",
    "hote", "hôte", "host", "firing", "pending",
}

def _is_live_topic(insight: dict) -> bool:
    cat = insight.get("category", "").lower().strip()
    return any(kw in cat for kw in _LIVE_TOPICS)


# ─── Score Calculator ────────────────────────────────────────────────────────

def compute_score_breakdown(prometheus: dict, loki: dict,
                             signoz: dict, veeam: dict) -> list:
    rows  = []
    score = 100.0

    def add(categorie, detail, delta):
        nonlocal score
        score += delta
        score  = max(0.0, min(100.0, score))
        rows.append({
            "categorie": categorie,
            "detail":    detail,
            "impact":    delta,
            "cumul":     round(score, 1),
        })

    host        = prometheus.get("host", {})
    cpu_pct     = host.get("cpu_pct", 0)
    mem_pct     = host.get("mem_pct", 0)
    power       = host.get("power_state", 1)
    maintenance = host.get("maintenance_mode", False)

    if power != 1:
        add("Host", f"Hôte hors tension (power_state={power})", -30)
    if maintenance:
        add("Host", "Hôte en mode maintenance", -10)

    if cpu_pct > 90:
        add("CPU", f"CPU critique : {cpu_pct:.1f}%  (> 90%)", -20)
    elif cpu_pct > 70:
        add("CPU", f"CPU élevé : {cpu_pct:.1f}%  (> 70%)", -10)
    else:
        add("CPU", f"CPU nominal : {cpu_pct:.1f}%", 0)

    if mem_pct > 90:
        add("Mémoire", f"Mémoire critique : {mem_pct:.1f}%  (> 90%)", -20)
    elif mem_pct > 75:
        add("Mémoire", f"Mémoire élevée : {mem_pct:.1f}%  (> 75%)", -8)
    else:
        add("Mémoire", f"Mémoire nominale : {mem_pct:.1f}%", 0)

    ds         = prometheus.get("datastore", {})
    free_pct   = ds.get("free_pct", 100)
    accessible = ds.get("accessible", True)

    if not accessible:
        add("Datastore", f"Datastore '{ds.get('name')}' inaccessible", -35)
    if free_pct < 10:
        add("Datastore", f"Espace critique : {free_pct:.1f}% libre  (< 10%)", -25)
    elif free_pct < 20:
        add("Datastore", f"Espace faible : {free_pct:.1f}% libre  (< 20%)", -10)
    else:
        add("Datastore", f"Espace OK : {free_pct:.1f}% libre", 0)

    vms        = prometheus.get("vms", {})
    total_vms  = len(vms)
    powered_on = _count_powered_on(vms)

    logger.info(
        f"[Score] VMs : {powered_on}/{total_vms} allumées "
        f"({[n for n, v in vms.items() if v.get('power_state') == 'poweredOn']})"
    )

    if total_vms > 0 and powered_on == 0:
        add("VMs", "Aucune VM en cours d'exécution", -5)
    else:
        add("VMs", f"{powered_on}/{total_vms} VMs allumées", 0)

    vms_balloon = [
        n for n, v in vms.items() if v.get("mem_balloon_kb", 0) > 102400
    ]
    if vms_balloon:
        add("VMs",
            f"Pression mémoire (balloon) sur : {', '.join(vms_balloon)}",
            -(len(vms_balloon) * 3))

    veeam_global  = veeam.get("global", {})
    sla_pct       = veeam_global.get("sla_pct", 100)
    failed_count  = veeam_global.get("jobs_failed_count", 0)
    warning_count = veeam_global.get("jobs_warning_count", 0)
    jobs          = veeam.get("jobs", [])

    if sla_pct < 50:
        add("Backup", f"SLA critique : {sla_pct:.1f}%  (objectif ≥ 90%)", -20)
    elif sla_pct < 80:
        add("Backup", f"SLA insuffisant : {sla_pct:.1f}%  (objectif ≥ 90%)", -10)
    else:
        add("Backup", f"SLA satisfaisant : {sla_pct:.1f}%", 0)

    if failed_count > 0:
        add("Backup",
            f"{failed_count} job(s) en échec  (−5 pts / job)",
            -(failed_count * 5))
    if warning_count > 0:
        add("Backup",
            f"{warning_count} job(s) en avertissement  (−3 pts / job)",
            -(warning_count * 3))

    for job in jobs:
        if not job.get("last_success_time") and job.get("status") in ["failed", "warning"]:
            add("Backup",
                f"Job '{job['job_name']}' : aucun backup réussi jamais", -8)

    total_errors   = loki.get("total_errors", 0)
    total_critical = loki.get("total_critical", 0)

    if total_critical > 50:
        add("Logs",
            f"{total_critical} messages critiques dans les logs  (> 50)", -15)
    elif total_critical > 10:
        add("Logs",
            f"{total_critical} messages critiques dans les logs  (> 10)", -8)
    else:
        add("Logs", f"{total_critical} messages critiques (OK)", 0)

    if total_errors > 200:
        add("Logs",
            f"Volume d'erreurs élevé : {total_errors} erreurs en 12h  (> 200)", -5)
    else:
        add("Logs", f"{total_errors} erreurs en 12h (OK)", 0)

    prom_alerts   = prometheus.get("alerts", [])
    firing_prom   = [a for a in prom_alerts if a.get("state") == "firing"]
    critical_prom = [
        a for a in firing_prom
        if a.get("labels", {}).get("severity") == "critical"
    ]
    signoz_data   = signoz if signoz else {}
    firing_signoz = signoz_data.get("firing", 0)

    if critical_prom:
        names = [a.get("labels", {}).get("alertname", "?") for a in critical_prom]
        add("Alertes",
            f"{len(critical_prom)} alerte(s) critique(s) : {', '.join(names)}"
            f"  (−10 pts / alerte)",
            -(len(critical_prom) * 10))
    else:
        add("Alertes", "Aucune alerte critique Prometheus (firing)", 0)

    if firing_signoz > 0:
        add("Alertes",
            f"{firing_signoz} alerte(s) Signoz active(s)  (−3 pts / alerte)",
            -(firing_signoz * 3))

    return rows


# ─── PDF Builder ─────────────────────────────────────────────────────────────

class PDFReportBuilder:

    def __init__(self):
        os.makedirs(REPORTS_DIR, exist_ok=True)
        self.styles = getSampleStyleSheet()
        self._setup_styles()

    def _setup_styles(self):
        self.style_title = ParagraphStyle(
            "ReportTitle", fontSize=24, textColor=C_WHITE,
            fontName="Helvetica-Bold", alignment=TA_CENTER, leading=30,
        )
        self.style_subtitle = ParagraphStyle(
            "ReportSubtitle", fontSize=10,
            textColor=colors.HexColor("#93c5fd"),
            fontName="Helvetica", alignment=TA_CENTER, leading=14,
        )
        self.style_section = ParagraphStyle(
            "SectionHeader", fontSize=14, textColor=C_BLUE_DARK,
            fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=6,
            leading=18, borderPad=4,
        )
        self.style_body = ParagraphStyle(
            "Body", fontSize=9, textColor=colors.HexColor("#1e293b"),
            fontName="Helvetica", leading=14, alignment=TA_JUSTIFY,
        )
        self.style_small = ParagraphStyle(
            "Small", fontSize=8, textColor=C_GRAY,
            fontName="Helvetica", leading=11,
        )
        self.style_insight = ParagraphStyle(
            "Insight", fontSize=9, textColor=colors.HexColor("#1e293b"),
            fontName="Helvetica", leading=13, leftIndent=6,
        )
        self.style_bold = ParagraphStyle(
            "Bold", fontSize=9, textColor=colors.HexColor("#0f172a"),
            fontName="Helvetica-Bold", leading=13,
        )

    # ─── Helpers ─────────────────────────────────────────────────────────────

    def _fig_to_image(self, fig, width=16*cm, height=7*cm) -> Image:
        buf = io.BytesIO()
        fig.savefig(buf, format="png", dpi=150, bbox_inches="tight",
                    facecolor=fig.get_facecolor())
        buf.seek(0)
        plt.close(fig)
        return Image(buf, width=width, height=height)

    def _table_style_base(self, header_color=None):
        hc = header_color or C_BLUE_DARK
        return TableStyle([
            ("BACKGROUND",     (0, 0), (-1, 0),  hc),
            ("TEXTCOLOR",      (0, 0), (-1, 0),  C_WHITE),
            ("FONTNAME",       (0, 0), (-1, 0),  "Helvetica-Bold"),
            ("FONTSIZE",       (0, 0), (-1, 0),  8),
            ("FONTNAME",       (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE",       (0, 1), (-1, -1), 8),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [C_WHITE, C_GRAY_LIGHT]),
            ("GRID",           (0, 0), (-1, -1), 0.25, C_BORDER),
            ("VALIGN",         (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",     (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING",  (0, 0), (-1, -1), 5),
            ("LEFTPADDING",    (0, 0), (-1, -1), 7),
            ("RIGHTPADDING",   (0, 0), (-1, -1), 7),
            ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ])

    def _section_title(self, text: str, icon: str = "") -> list:
        elements   = []
        title_text = f"{icon}  {text}" if icon else text
        elements.append(Spacer(1, 0.3*cm))
        elements.append(Paragraph(title_text, self.style_section))
        elements.append(HRFlowable(width="100%", thickness=1.5,
                                   color=C_BLUE_MED, spaceAfter=8))
        return elements

    def _kpi_row(self, kpis: list) -> Table:
        col_w = (17*cm) / len(kpis)
        cells_val, cells_lbl = [], []
        for i, (label, value, color) in enumerate(kpis):
            cells_val.append(Paragraph(
                f'<font size="18"><b>{value}</b></font>',
                ParagraphStyle(f"kv{i}", alignment=TA_CENTER,
                               textColor=colors.HexColor(color),
                               fontName="Helvetica-Bold", leading=22),
            ))
            cells_lbl.append(Paragraph(
                f'<font size="7.5">{label}</font>',
                ParagraphStyle(f"kl{i}", alignment=TA_CENTER,
                               textColor=C_GRAY, fontName="Helvetica"),
            ))
        t = Table([cells_val, cells_lbl], colWidths=[col_w]*len(kpis))
        style = [
            ("VALIGN",         (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",     (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING",  (0, 0), (-1, -1), 8),
            ("GRID",           (0, 0), (-1, -1), 0.3, C_BORDER),
            ("BACKGROUND",     (0, 0), (-1, -1), C_GRAY_LIGHT),
            ("ROUNDEDCORNERS", [6, 6, 6, 6]),
        ]
        for i, (_, _, color) in enumerate(kpis):
            style.append(("BACKGROUND", (i, 0), (i, 0),
                           colors.HexColor(color + "15")))
        t.setStyle(TableStyle(style))
        return t

    # ─── Charts ──────────────────────────────────────────────────────────────

    def _chart_score_breakdown(self, score_rows: list) -> Image:
        non_zero = [r for r in score_rows if r["impact"] != 0]
        if not non_zero:
            non_zero = score_rows[:1]

        labels  = [r["categorie"] + "\n" + r["detail"][:30] for r in non_zero]
        impacts = [r["impact"] for r in non_zero]
        cumuls  = [r["cumul"]  for r in non_zero]

        fig, ax = plt.subplots(
            figsize=(13, max(3.5, len(non_zero) * 0.55)), facecolor="white"
        )
        y_pos      = range(len(labels))
        bar_colors = ["#ef4444" if v < 0 else "#22c55e" for v in impacts]
        bars       = ax.barh(list(y_pos), impacts, color=bar_colors,
                             alpha=0.85, height=0.55, edgecolor="white")

        for bar, val, cum in zip(bars, impacts, cumuls):
            ax.text(
                bar.get_width() + (0.3 if val >= 0 else -0.3),
                bar.get_y() + bar.get_height() / 2,
                f"{val:+.0f} pts  →  {cum}/100",
                va="center", ha="left" if val >= 0 else "right",
                fontsize=7, color="#1e293b", fontweight="bold",
            )

        ax.set_yticks(list(y_pos))
        ax.set_yticklabels(labels, fontsize=6.5)
        ax.set_xlabel("Impact sur le score (pts)", fontsize=8)
        ax.set_title("Décomposition du Score de Santé", fontsize=10,
                     fontweight="bold", color="#1a2744")
        ax.axvline(x=0, color="#1a2744", linewidth=0.8)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.grid(axis="x", alpha=0.3, linestyle="--")
        plt.tight_layout(pad=1.5)
        return self._fig_to_image(fig, width=17*cm,
                                  height=max(6*cm, len(non_zero) * 0.7*cm))

    def _chart_cpu_mem(self, prom_data: dict) -> Image:
        trends     = prom_data.get("trends", {})
        cpu_data   = trends.get("cpu",    {})
        mem_data   = trends.get("memory", {})
        host       = prom_data.get("host", {})
        mem_max_mb = host.get("mem_max_mb", 1) or 1

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 3.5), facecolor="white")

        if cpu_data.get("timestamps") and cpu_data.get("values"):
            cpu_vals = _safe_pct_values(cpu_data["values"])
            x        = range(len(cpu_data["timestamps"]))
            ax1.fill_between(x, cpu_vals, alpha=0.25, color="#2563eb")
            ax1.plot(x, cpu_vals, color="#2563eb", linewidth=2,
                     marker="o", markersize=2)
            step = max(1, len(cpu_data["timestamps"]) // 8)
            ax1.set_xticks(list(x)[::step])
            ax1.set_xticklabels(cpu_data["timestamps"][::step],
                                rotation=30, fontsize=6)
            ax1.axhline(y=90, color="#dc2626", linestyle="--",
                        linewidth=0.8, alpha=0.7, label="Critique 90%")
            ax1.axhline(y=70, color="#ea580c", linestyle="--",
                        linewidth=0.8, alpha=0.7, label="Warning 70%")
            ax1.legend(fontsize=6)
            last_val = cpu_vals[-1] if cpu_vals else 0
            ax1.annotate(f"{last_val:.1f}%",
                         xy=(len(cpu_vals)-1, last_val),
                         xytext=(len(cpu_vals)-1, last_val + 5),
                         fontsize=7, color="#1e293b", fontweight="bold",
                         ha="right")
        else:
            cpu_val = host.get("cpu_pct", 0)
            ax1.bar(["Actuel"], [cpu_val], color="#2563eb", alpha=0.8)
            ax1.text(0, cpu_val + 1, f"{cpu_val:.1f}%",
                     ha="center", fontsize=9, fontweight="bold", color="#1e293b")

        ax1.set_title("CPU Hôte (%)", fontsize=10, fontweight="bold", color="#1a2744")
        ax1.set_ylabel("%", fontsize=8)
        ax1.set_ylim(0, 105)
        ax1.tick_params(labelsize=7)
        ax1.grid(axis="y", alpha=0.3, linestyle="--")
        ax1.spines["top"].set_visible(False)
        ax1.spines["right"].set_visible(False)

        if mem_data.get("timestamps") and mem_data.get("values"):
            mem_pct_vals = _mb_to_pct(mem_data["values"], mem_max_mb)
            x2 = range(len(mem_data["timestamps"]))
            ax2.fill_between(x2, mem_pct_vals, alpha=0.25, color="#7c3aed")
            ax2.plot(x2, mem_pct_vals, color="#7c3aed", linewidth=2)
            step2 = max(1, len(mem_data["timestamps"]) // 8)
            ax2.set_xticks(list(x2)[::step2])
            ax2.set_xticklabels(mem_data["timestamps"][::step2],
                                rotation=30, fontsize=6)
            ax2.axhline(y=90, color="#dc2626", linestyle="--",
                        linewidth=0.8, alpha=0.7, label="Critique 90%")
            ax2.axhline(y=75, color="#ea580c", linestyle="--",
                        linewidth=0.8, alpha=0.7, label="Warning 75%")
            ax2.legend(fontsize=6)
            last_mem = mem_pct_vals[-1] if mem_pct_vals else 0
            ax2.annotate(f"{last_mem:.1f}%",
                         xy=(len(mem_pct_vals)-1, last_mem),
                         xytext=(len(mem_pct_vals)-1, last_mem + 5),
                         fontsize=7, color="#1e293b", fontweight="bold",
                         ha="right")
        else:
            mem_val = host.get("mem_pct", 0)
            ax2.bar(["Actuel"], [mem_val], color="#7c3aed", alpha=0.8)
            ax2.text(0, mem_val + 1, f"{mem_val:.1f}%",
                     ha="center", fontsize=9, fontweight="bold", color="#1e293b")

        ax2.set_title("Mémoire Hôte (%)", fontsize=10, fontweight="bold", color="#1a2744")
        ax2.set_ylabel("%", fontsize=8)
        ax2.set_ylim(0, 105)
        ax2.tick_params(labelsize=7)
        ax2.grid(axis="y", alpha=0.3, linestyle="--")
        ax2.spines["top"].set_visible(False)
        ax2.spines["right"].set_visible(False)

        plt.tight_layout(pad=1.5)
        return self._fig_to_image(fig, width=17*cm, height=6.5*cm)

    def _chart_datastore(self, prom_data: dict) -> Image:
        ds      = prom_data.get("datastore", {})
        used_gb = ds.get("used_gb", 0)
        free_gb = ds.get("free_gb", 0)
        cap_gb  = ds.get("capacity_gb", 1)

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(10, 3.5), facecolor="white")

        sizes = [used_gb, free_gb]
        lbls  = [f"Utilisé\n{used_gb:.1f} GB", f"Libre\n{free_gb:.1f} GB"]
        clrs  = [
            "#ef4444" if ds.get("free_pct", 50) < 20 else "#2563eb",
            "#dcfce7",
        ]
        ax1.pie(sizes, labels=lbls, colors=clrs, autopct="%1.1f%%",
                startangle=90, wedgeprops={"width": 0.55, "edgecolor": "white"},
                textprops={"fontsize": 8})
        ax1.set_title(f"Datastore: {ds.get('name', 'N/A')}\n{cap_gb:.1f} GB total",
                      fontsize=9, fontweight="bold", color="#1a2744")

        used_pct  = ds.get("used_pct", 0)
        free_pct  = ds.get("free_pct", 100)
        bar_color = ("#ef4444" if free_pct < 10
                     else "#ea580c" if free_pct < 20 else "#2563eb")
        ax2.barh(["Utilisé"], [used_pct], color=bar_color, alpha=0.85, height=0.4)
        ax2.barh(["Libre"],   [free_pct], color="#22c55e", alpha=0.75, height=0.4)
        ax2.set_xlim(0, 100)
        ax2.set_xlabel("%", fontsize=8)
        ax2.set_title("Répartition espace (%)", fontsize=9,
                      fontweight="bold", color="#1a2744")
        ax2.tick_params(labelsize=8)
        ax2.spines["top"].set_visible(False)
        ax2.spines["right"].set_visible(False)
        for i, val in enumerate([used_pct, free_pct]):
            ax2.text(val + 1, i, f"{val:.1f}%", va="center",
                     fontsize=8, color="#1e293b")

        plt.tight_layout(pad=1.5)
        return self._fig_to_image(fig, width=15*cm, height=6*cm)

    def _chart_vms_cpu_mem(self, vms: dict) -> Image:
        powered_vms = {
            n: v for n, v in vms.items()
            if v.get("power_state") == "poweredOn"
        }
        if not powered_vms:
            powered_vms = dict(vms)

        vm_names = list(powered_vms.keys())[:12]
        cpu_vals = _safe_pct_values([powered_vms[n].get("cpu_pct", 0) for n in vm_names])
        mem_vals = _safe_pct_values([powered_vms[n].get("mem_pct", 0) for n in vm_names])

        n     = len(vm_names)
        x     = np.arange(n)
        width = 0.38
        fig, ax = plt.subplots(figsize=(max(8, n * 1.1), 4.5), facecolor="white")

        bars_cpu = ax.bar(x - width/2, cpu_vals, width, label="CPU (%)",
                          color="#2563eb", alpha=0.82, edgecolor="white")
        bars_mem = ax.bar(x + width/2, mem_vals, width, label="RAM (%)",
                          color="#7c3aed", alpha=0.82, edgecolor="white")

        for bar, val in zip(bars_cpu, cpu_vals):
            if val >= 90:   bar.set_color("#dc2626")
            elif val >= 70: bar.set_color("#ea580c")
        for bar, val in zip(bars_mem, mem_vals):
            if val >= 90:   bar.set_color("#dc2626")
            elif val >= 75: bar.set_color("#ea580c")

        for bar, val in zip(list(bars_cpu) + list(bars_mem),
                            list(cpu_vals) + list(mem_vals)):
            if val > 3:
                ax.text(bar.get_x() + bar.get_width() / 2,
                        bar.get_height() + 1,
                        f"{val:.0f}%", ha="center", va="bottom",
                        fontsize=6.5, fontweight="bold", color="#1e293b")

        ax.axhline(y=90, color="#dc2626", linestyle="--",
                   linewidth=0.8, alpha=0.6, label="Critique 90%")
        ax.axhline(y=70, color="#ea580c", linestyle="--",
                   linewidth=0.8, alpha=0.6, label="Warning 70%")
        ax.set_ylim(0, 110)
        ax.set_xticks(x)
        ax.set_xticklabels(vm_names, rotation=30, ha="right", fontsize=7)
        ax.set_ylabel("%", fontsize=8)
        ax.set_title("CPU & RAM par VM (VMs allumées)", fontsize=10,
                     fontweight="bold", color="#1a2744")
        ax.legend(fontsize=7, loc="upper right")
        ax.grid(axis="y", alpha=0.3, linestyle="--")
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        plt.tight_layout(pad=1.5)
        return self._fig_to_image(fig, width=17*cm, height=7*cm)

    def _chart_vms_trends(self, vms: dict) -> Image:
        powered_vms = {
            n: v for n, v in vms.items()
            if v.get("power_state") == "poweredOn"
            and v.get("trends", {}).get("cpu", {}).get("values")
        }
        if not powered_vms:
            return None

        fig, ax = plt.subplots(figsize=(12, 4), facecolor="white")
        palette = ["#2563eb", "#7c3aed", "#16a34a", "#ea580c", "#dc2626",
                   "#0891b2", "#ca8a04", "#db2777"]

        for i, (vm_name, vm) in enumerate(list(powered_vms.items())[:8]):
            trend  = vm["trends"]["cpu"]
            vals   = _safe_pct_values(trend["values"])
            times  = trend["timestamps"]
            color  = palette[i % len(palette)]
            x      = range(len(vals))
            ax.plot(x, vals, color=color, linewidth=1.5,
                    label=vm_name, marker="o", markersize=1.5)
            step = max(1, len(times) // 8)
            ax.set_xticks(list(x)[::step])
            ax.set_xticklabels(times[::step], rotation=30, fontsize=6)

        ax.axhline(y=90, color="#dc2626", linestyle="--",
                   linewidth=0.8, alpha=0.5, label="Critique 90%")
        ax.axhline(y=70, color="#ea580c", linestyle="--",
                   linewidth=0.8, alpha=0.5, label="Warning 70%")
        ax.set_ylim(0, 105)
        ax.set_ylabel("CPU %", fontsize=8)
        ax.set_title("Évolution CPU par VM (12h)", fontsize=10,
                     fontweight="bold", color="#1a2744")
        ax.legend(fontsize=6, loc="upper right", ncol=2)
        ax.grid(axis="y", alpha=0.3, linestyle="--")
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        plt.tight_layout(pad=1.5)
        return self._fig_to_image(fig, width=17*cm, height=6*cm)

    def _chart_vms_io(self, vms: dict) -> Image:
        powered_vms = {
            n: v for n, v in vms.items()
            if v.get("power_state") == "poweredOn"
        }
        if not powered_vms:
            return None

        active = {
            n: v for n, v in powered_vms.items()
            if (v.get("disk_read_kbs", 0) + v.get("disk_write_kbs", 0)
                + v.get("net_rx_kbs", 0) + v.get("net_tx_kbs", 0)) > 0
        }
        if not active:
            return None

        vm_names   = list(active.keys())[:10]
        disk_read  = [active[n].get("disk_read_kbs",  0) for n in vm_names]
        disk_write = [active[n].get("disk_write_kbs", 0) for n in vm_names]
        net_rx     = [active[n].get("net_rx_kbs",     0) for n in vm_names]
        net_tx     = [active[n].get("net_tx_kbs",     0) for n in vm_names]

        fig, (ax1, ax2) = plt.subplots(
            1, 2,
            figsize=(13, max(3.5, len(vm_names) * 0.5)),
            facecolor="white",
        )
        y = np.arange(len(vm_names))
        h = 0.35

        ax1.barh(y + h/2, disk_read,  h, label="Lecture",  color="#2563eb", alpha=0.82)
        ax1.barh(y - h/2, disk_write, h, label="Ecriture", color="#7c3aed", alpha=0.82)
        ax1.set_yticks(y)
        ax1.set_yticklabels(vm_names, fontsize=7)
        ax1.set_xlabel("KB/s", fontsize=8)
        ax1.set_title("Disque I/O par VM (KB/s)", fontsize=9,
                      fontweight="bold", color="#1a2744")
        ax1.legend(fontsize=7)
        ax1.spines["top"].set_visible(False)
        ax1.spines["right"].set_visible(False)
        ax1.grid(axis="x", alpha=0.3, linestyle="--")

        ax2.barh(y + h/2, net_rx, h, label="RX", color="#16a34a", alpha=0.82)
        ax2.barh(y - h/2, net_tx, h, label="TX", color="#ea580c", alpha=0.82)
        ax2.set_yticks(y)
        ax2.set_yticklabels(vm_names, fontsize=7)
        ax2.set_xlabel("KB/s", fontsize=8)
        ax2.set_title("Réseau par VM (KB/s)", fontsize=9,
                      fontweight="bold", color="#1a2744")
        ax2.legend(fontsize=7)
        ax2.spines["top"].set_visible(False)
        ax2.spines["right"].set_visible(False)
        ax2.grid(axis="x", alpha=0.3, linestyle="--")

        plt.tight_layout(pad=1.5)
        return self._fig_to_image(fig, width=17*cm,
                                  height=max(5*cm, len(vm_names) * 0.7*cm))

    def _chart_backup_sla(self, veeam_data: dict) -> Image:
        jobs = veeam_data.get("jobs", [])
        if not jobs:
            return None

        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4), facecolor="white")

        job_names  = [j["job_name"][:18] for j in jobs]
        sla_values = [j.get("sla_pct", 0) for j in jobs]
        bar_colors = []
        for s in sla_values:
            if s >= 80:   bar_colors.append("#22c55e")
            elif s >= 50: bar_colors.append("#f59e0b")
            else:         bar_colors.append("#ef4444")

        x_pos = range(len(job_names))
        bars  = ax1.bar(x_pos, sla_values, color=bar_colors,
                        alpha=0.85, edgecolor="white")
        ax1.set_xticks(list(x_pos))
        ax1.set_xticklabels(job_names, rotation=35, ha="right", fontsize=7)
        ax1.set_ylim(0, 110)
        ax1.set_ylabel("SLA %", fontsize=8)
        ax1.set_title("SLA par Job de Backup (30j)", fontsize=10,
                      fontweight="bold", color="#1a2744")
        ax1.axhline(y=90, color="#1a2744", linestyle="--",
                    linewidth=0.8, alpha=0.5, label="Obj 90%")
        ax1.legend(fontsize=7)
        ax1.grid(axis="y", alpha=0.3, linestyle="--")
        ax1.spines["top"].set_visible(False)
        ax1.spines["right"].set_visible(False)
        for bar, val in zip(bars, sla_values):
            ax1.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 1,
                     f"{val:.0f}%", ha="center", va="bottom",
                     fontsize=6.5, fontweight="bold")

        g      = veeam_data.get("global", {})
        ok_c   = g.get("jobs_ok_count",      0)
        fail_c = g.get("jobs_failed_count",  0)
        warn_c = g.get("jobs_warning_count", 0)
        pie_data, pie_labels, pie_colors = [], [], []
        if ok_c   > 0: pie_data.append(ok_c);   pie_labels.append(f"Succès ({ok_c})");   pie_colors.append("#22c55e")
        if warn_c > 0: pie_data.append(warn_c); pie_labels.append(f"Avert. ({warn_c})"); pie_colors.append("#f59e0b")
        if fail_c > 0: pie_data.append(fail_c); pie_labels.append(f"Échec ({fail_c})");  pie_colors.append("#ef4444")
        if not pie_data:
            pie_data = [1]; pie_labels = ["Aucun"]; pie_colors = ["#94a3b8"]

        ax2.pie(pie_data, labels=pie_labels, colors=pie_colors, autopct="%1.0f%%",
                startangle=90,
                wedgeprops={"edgecolor": "white", "linewidth": 1.5},
                textprops={"fontsize": 8})
        ax2.set_title("Répartition Jobs\npar Statut", fontsize=10,
                      fontweight="bold", color="#1a2744")
        plt.tight_layout(pad=1.5)
        return self._fig_to_image(fig, width=17*cm, height=6.5*cm)

    def _chart_logs_errors(self, loki_data: dict) -> Image:
        timeline   = loki_data.get("error_timeline", {})
        top_errors = loki_data.get("top_errors", [])

        fig, axes = plt.subplots(1, 2, figsize=(12, 3.5), facecolor="white")

        if timeline:
            hours  = sorted(timeline.keys())[-24:]
            vals   = [timeline[h] for h in hours]
            labels = [h[11:] + "h" for h in hours]
            axes[0].bar(range(len(hours)), vals, color="#ef4444", alpha=0.75)
            step = max(1, len(hours) // 6)
            axes[0].set_xticks(list(range(len(hours)))[::step])
            axes[0].set_xticklabels(labels[::step], rotation=30, fontsize=7)
        else:
            axes[0].bar(["Erreurs"], [loki_data.get("total_errors", 0)],
                        color="#ef4444", alpha=0.75)
        axes[0].set_title("Erreurs par heure (12h)", fontsize=10,
                          fontweight="bold", color="#1a2744")
        axes[0].set_ylabel("Nb erreurs", fontsize=8)
        axes[0].grid(axis="y", alpha=0.3, linestyle="--")
        axes[0].spines["top"].set_visible(False)
        axes[0].spines["right"].set_visible(False)

        if top_errors:
            msgs  = [e["message"][:35] + "..." for e in top_errors[:8]]
            cnts  = [e["count"] for e in top_errors[:8]]
            y_pos = range(len(msgs))
            axes[1].barh(list(y_pos), cnts, color="#f59e0b", alpha=0.8)
            axes[1].set_yticks(list(y_pos))
            axes[1].set_yticklabels(msgs, fontsize=6.5)
            axes[1].set_xlabel("Occurrences", fontsize=8)
            axes[1].set_title("Top Erreurs Logs", fontsize=10,
                              fontweight="bold", color="#1a2744")
            axes[1].spines["top"].set_visible(False)
            axes[1].spines["right"].set_visible(False)
        else:
            axes[1].text(0.5, 0.5, "Aucune erreur\ndétectée",
                         ha="center", va="center",
                         transform=axes[1].transAxes,
                         fontsize=12, color="#22c55e")
            axes[1].axis("off")

        plt.tight_layout(pad=1.5)
        return self._fig_to_image(fig, width=17*cm, height=6*cm)

    # ─── Insights live (prometheus direct) ──────────────────────────────────

    def _compute_live_insights(self, prom: dict) -> list:
        """
        Insights calculés exclusivement depuis prometheus["vms"] et prometheus["host"].
        Ces insights remplacent TOUS les insights LLM sur les mêmes sujets.
        """
        insights = []
        vms  = prom.get("vms", {})
        host = prom.get("host", {})
        ds   = prom.get("datastore", {})

        total   = len(vms)
        powered = [n for n, v in vms.items() if v.get("power_state") == "poweredOn"]
        off     = [n for n, v in vms.items() if v.get("power_state") != "poweredOn"]

        insights.append({
            "level":    "OK" if powered else "WARNING",
            "category": "VMs",
            "message":  (
                f"{len(powered)}/{total} VM(s) allumée(s)"
                + (f" — éteintes : {', '.join(off)}" if off else "")
            ),
        })

        cpu_crit = [n for n, v in vms.items() if v.get("cpu_pct", 0) >= 90]
        cpu_warn = [n for n, v in vms.items() if 70 <= v.get("cpu_pct", 0) < 90]
        if cpu_crit:
            insights.append({"level": "CRITICAL", "category": "CPU VMs",
                              "message": f"CPU ≥ 90% sur : {', '.join(cpu_crit)}"})
        elif cpu_warn:
            insights.append({"level": "WARNING", "category": "CPU VMs",
                              "message": f"CPU ≥ 70% sur : {', '.join(cpu_warn)}"})
        else:
            insights.append({"level": "OK", "category": "CPU VMs",
                              "message": "CPU nominal sur toutes les VMs allumées"})

        mem_crit = [n for n, v in vms.items() if v.get("mem_pct", 0) >= 90]
        mem_warn = [n for n, v in vms.items() if 75 <= v.get("mem_pct", 0) < 90]
        if mem_crit:
            insights.append({"level": "CRITICAL", "category": "RAM VMs",
                              "message": f"RAM ≥ 90% sur : {', '.join(mem_crit)}"})
        elif mem_warn:
            insights.append({"level": "WARNING", "category": "RAM VMs",
                              "message": f"RAM ≥ 75% sur : {', '.join(mem_warn)}"})
        else:
            insights.append({"level": "OK", "category": "RAM VMs",
                              "message": "RAM nominale sur toutes les VMs allumées"})

        balloon = [n for n, v in vms.items() if v.get("mem_balloon_kb", 0) > 102400]
        if balloon:
            insights.append({"level": "HIGH", "category": "Mémoire Balloon",
                              "message": f"Pression mémoire (balloon > 100 MB) sur : {', '.join(balloon)}"})

        no_tools = [n for n, v in vms.items()
                    if v.get("power_state") == "poweredOn"
                    and v.get("tools_status", "") != "toolsOk"]
        if no_tools:
            insights.append({"level": "WARNING", "category": "VMware Tools",
                              "message": f"Tools non OK sur : {', '.join(no_tools)}"})

        host_cpu = host.get("cpu_pct", 0)
        if host_cpu >= 90:
            insights.append({"level": "CRITICAL", "category": "CPU Hôte",
                              "message": f"CPU hôte critique : {host_cpu:.1f}%"})
        elif host_cpu >= 70:
            insights.append({"level": "WARNING", "category": "CPU Hôte",
                              "message": f"CPU hôte élevé : {host_cpu:.1f}%"})

        host_mem = host.get("mem_pct", 0)
        if host_mem >= 90:
            insights.append({"level": "CRITICAL", "category": "RAM Hôte",
                              "message": f"Mémoire hôte critique : {host_mem:.1f}%"})
        elif host_mem >= 75:
            insights.append({"level": "WARNING", "category": "RAM Hôte",
                              "message": f"Mémoire hôte élevée : {host_mem:.1f}%"})

        ds_free = ds.get("free_pct", 100)
        if ds_free < 10:
            insights.append({"level": "CRITICAL", "category": "Datastore",
                              "message": f"Espace libre critique : {ds_free:.1f}% libre"})
        elif ds_free < 20:
            insights.append({"level": "WARNING", "category": "Datastore",
                              "message": f"Espace libre faible : {ds_free:.1f}% libre"})

        prom_alerts    = prom.get("alerts", [])
        firing_alerts  = [a for a in prom_alerts if a.get("state") == "firing"]
        pending_alerts = [a for a in prom_alerts if a.get("state") == "pending"]

        if firing_alerts:
            names = [a.get("labels", {}).get("alertname", "?") for a in firing_alerts]
            insights.append({"level": "CRITICAL", "category": "Alertes Firing",
                              "message": f"{len(firing_alerts)} alerte(s) active(s) : {', '.join(names)}"})
        if pending_alerts:
            names = list({a.get("labels", {}).get("alertname", "?") for a in pending_alerts})
            insights.append({"level": "WARNING", "category": "Alertes Pending",
                              "message": (f"{len(pending_alerts)} alerte(s) en attente "
                                          f"(pending, pas encore firing) : {', '.join(names)}")})

        return insights

    # ─── MAIN BUILD ──────────────────────────────────────────────────────────

    def build(self, prometheus: dict, loki: dict, signoz: dict,
              veeam: dict, analysis: dict, period_start: datetime,
              period_end: datetime) -> tuple:
        ts       = period_end.strftime("%Y-%m-%d_%H-%M")
        filename = f"report_{ts}.pdf"
        filepath = os.path.join(REPORTS_DIR, filename)

        doc = SimpleDocTemplate(
            filepath, pagesize=A4,
            leftMargin=1.8*cm, rightMargin=1.8*cm,
            topMargin=1.5*cm,  bottomMargin=1.5*cm,
            title=f"Rapport ESXi - {period_end.strftime('%d/%m/%Y %H:%M')}",
            author="ESXi Reporter Platform",
        )

        score_rows = compute_score_breakdown(prometheus, loki, signoz, veeam)

        elements  = []
        elements += self._build_cover(analysis, prometheus, period_start,
                                      period_end, score_rows)
        elements.append(PageBreak())
        elements += self._build_executive_summary(analysis, prometheus,
                                                   veeam, loki, signoz)
        elements.append(PageBreak())
        elements += self._build_esxi_section(prometheus)
        elements.append(PageBreak())
        elements += self._build_vms_section(prometheus)
        elements.append(PageBreak())
        elements += self._build_backup_section(veeam)
        elements.append(PageBreak())
        elements += self._build_logs_section(loki, signoz)
        elements += self._build_correlations_section(analysis)

        doc.build(elements,
                  onFirstPage=self._header_footer,
                  onLaterPages=self._header_footer)
        logger.info(f"[PDF] Generated: {filepath}")
        return filepath, filename

    def _header_footer(self, canvas, doc):
        canvas.saveState()
        w, h = A4
        canvas.setFillColor(C_BLUE_DARK)
        canvas.rect(0, 0, w, 1.2*cm, fill=True, stroke=False)
        canvas.setFillColor(C_WHITE)
        canvas.setFont("Helvetica", 7.5)
        canvas.drawString(1.8*cm, 0.45*cm,
                          "ESXi Reporter Platform - Rapport confidentiel")
        canvas.drawRightString(w - 1.8*cm, 0.45*cm, f"Page {doc.page}")
        canvas.restoreState()

    # ─── COVER ───────────────────────────────────────────────────────────────

    def _build_cover(self, analysis, prometheus, period_start,
                     period_end, score_rows) -> list:
        elements     = []
        health_label = analysis.get("health_label", "UNKNOWN")
        health_score = analysis.get("health_score", 0)

        score_color_hex = {
            "HEALTHY":  "#16a34a",
            "WARNING":  "#ca8a04",
            "DEGRADED": "#ea580c",
            "CRITICAL": "#dc2626",
        }.get(health_label, "#64748b")

        score_label = {
            "HEALTHY":  "Bon etat",
            "WARNING":  "Attention",
            "DEGRADED": "Degrade",
            "CRITICAL": "Critique",
        }.get(health_label, health_label)

        title_style = ParagraphStyle(
            "CoverTitle", fontSize=22, textColor=C_WHITE,
            fontName="Helvetica-Bold", alignment=TA_CENTER, leading=28,
        )
        subtitle_style = ParagraphStyle(
            "CoverSub", fontSize=9, textColor=colors.HexColor("#93c5fd"),
            fontName="Helvetica", alignment=TA_CENTER, leading=13,
        )

        header_data = [
            [Paragraph("ESXi Infrastructure Report", title_style)],
            [Paragraph(f"Debut : {period_start.strftime('%d/%m/%Y  %H:%M')}",
                       subtitle_style)],
            [Paragraph(f"Fin   : {period_end.strftime('%d/%m/%Y  %H:%M')}",
                       subtitle_style)],
        ]
        header_table = Table(header_data, colWidths=[17*cm])
        header_table.setStyle(TableStyle([
            ("BACKGROUND",     (0, 0), (-1, -1), C_BLUE_DARK),
            ("TOPPADDING",     (0, 0), (-1, -1), 14),
            ("BOTTOMPADDING",  (0, 0), (-1, -1), 14),
            ("LEFTPADDING",    (0, 0), (-1, -1), 20),
            ("RIGHTPADDING",   (0, 0), (-1, -1), 20),
            ("ROUNDEDCORNERS", [10, 10, 10, 10]),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 0.5*cm))

        host      = prometheus.get("host", {})
        host_name = host.get("name", "Inconnu")
        gen_date  = period_end.strftime("%d/%m/%Y a %H:%M")
        meta_style = ParagraphStyle(
            "MetaInfo", fontSize=9, textColor=colors.HexColor("#475569"),
            fontName="Helvetica", alignment=TA_CENTER, leading=14,
        )
        elements.append(Paragraph(
            f"<b>Hote surveille :</b> {host_name}     |     "
            f"<b>Rapport genere le :</b> {gen_date}",
            meta_style,
        ))
        elements.append(Spacer(1, 0.5*cm))

        score_val_style = ParagraphStyle(
            "ScoreVal", fontSize=48,
            textColor=colors.HexColor(score_color_hex),
            fontName="Helvetica-Bold", alignment=TA_CENTER, leading=56,
        )
        score_sub_style = ParagraphStyle(
            "ScoreSub", fontSize=11,
            textColor=colors.HexColor(score_color_hex),
            fontName="Helvetica-Bold", alignment=TA_LEFT, leading=16,
        )
        score_max_style = ParagraphStyle(
            "ScoreMax", fontSize=10, textColor=C_GRAY,
            fontName="Helvetica", alignment=TA_LEFT, leading=14,
        )

        score_table = Table([[
            Paragraph(f"{health_score:.0f}", score_val_style),
            Table([
                [Paragraph("/100", score_max_style)],
                [Paragraph(score_label, score_sub_style)],
                [Paragraph(
                    f"Base : 100 pts  |  Deductions : {100 - health_score:.0f} pts",
                    ParagraphStyle("ScoreDelta", fontSize=7.5, textColor=C_GRAY,
                                   fontName="Helvetica", leading=11),
                )],
            ], colWidths=[9*cm]),
        ]], colWidths=[6*cm, 11*cm])
        score_table.setStyle(TableStyle([
            ("VALIGN",         (0, 0), (-1, -1), "MIDDLE"),
            ("BACKGROUND",     (0, 0), (-1, -1),
             colors.HexColor(score_color_hex + "12")),
            ("BOX",            (0, 0), (-1, -1), 2,
             colors.HexColor(score_color_hex)),
            ("TOPPADDING",     (0, 0), (-1, -1), 16),
            ("BOTTOMPADDING",  (0, 0), (-1, -1), 16),
            ("LEFTPADDING",    (0, 0), (-1, -1), 18),
            ("RIGHTPADDING",   (0, 0), (-1, -1), 18),
            ("ROUNDEDCORNERS", [8, 8, 8, 8]),
        ]))
        elements.append(score_table)
        elements.append(Spacer(1, 0.4*cm))

        summary = analysis.get("executive_summary", "")
        if summary:
            elements.append(Paragraph(summary, ParagraphStyle(
                "SummCover", fontSize=9, leading=15, fontName="Helvetica",
                textColor=colors.HexColor("#1e293b"), alignment=TA_JUSTIFY,
                borderPad=10, backColor=C_GRAY_LIGHT,
                borderColor=C_BORDER, borderWidth=1, borderRadius=6,
            )))
            elements.append(Spacer(1, 0.5*cm))

        elements += self._section_title("Justification detaillee du Score", "🔢")

        score_label_desc = ParagraphStyle(
            "ScoreDesc", fontSize=7.5, fontName="Helvetica",
            textColor=colors.HexColor("#1e293b"), leading=10,
        )
        table_data = [["Categorie", "Detail de l'evaluation",
                        "Impact (pts)", "Score cumule"]]
        for row in score_rows:
            delta        = row["impact"]
            cumul        = row["cumul"]
            impact_str   = f"{delta:+.0f}" if delta != 0 else "0"
            impact_color = C_RED if delta < 0 else C_GREEN if delta > 0 else C_GRAY
            cumul_color  = (C_GREEN  if cumul >= 85 else
                            C_YELLOW if cumul >= 65 else
                            C_ORANGE if cumul >= 40 else C_RED)
            table_data.append([
                Paragraph(row["categorie"], ParagraphStyle(
                    "ScoreCat", fontSize=7.5, fontName="Helvetica-Bold",
                    textColor=C_BLUE_DARK, leading=10)),
                Paragraph(row["detail"], score_label_desc),
                Paragraph(f"<b>{impact_str}</b>", ParagraphStyle(
                    "ScoreImp", fontSize=8, fontName="Helvetica-Bold",
                    textColor=impact_color, alignment=TA_CENTER, leading=11)),
                Paragraph(f"<b>{cumul}/100</b>", ParagraphStyle(
                    "ScoreCum", fontSize=8, fontName="Helvetica-Bold",
                    textColor=cumul_color, alignment=TA_CENTER, leading=11)),
            ])

        score_table2 = Table(table_data,
                             colWidths=[3*cm, 9*cm, 2.5*cm, 2.5*cm])
        score_table2.setStyle(self._table_style_base())
        elements.append(score_table2)
        elements.append(Spacer(1, 0.3*cm))

        try:
            chart = self._chart_score_breakdown(score_rows)
            if chart:
                elements.append(chart)
        except Exception as e:
            logger.warning(f"Chart score breakdown error: {e}")

        return elements

    # ─── EXECUTIVE SUMMARY ───────────────────────────────────────────────────

    def _build_executive_summary(self, analysis, prom, veeam, loki, signoz) -> list:
        elements = []
        elements += self._section_title("Resume Executif", "📋")

        host = prom.get("host", {})
        ds   = prom.get("datastore", {})
        vg   = veeam.get("global", {})
        vms  = prom.get("vms", {})

        # FIX — comptage toujours depuis prometheus, jamais depuis analysis
        powered_on_count = _count_powered_on(vms)
        total_vms_count  = len(vms)
        vms_color        = "#16a34a" if powered_on_count > 0 else "#dc2626"

        prom_alerts    = prom.get("alerts", [])
        firing_alerts  = [a for a in prom_alerts if a.get("state") == "firing"]
        pending_alerts = [a for a in prom_alerts if a.get("state") == "pending"]

        elements.append(self._kpi_row([
            ("Score Sante", f"{analysis.get('health_score', 0):.0f}/100",
             {"HEALTHY": "#16a34a", "WARNING": "#ca8a04",
              "DEGRADED": "#ea580c", "CRITICAL": "#dc2626"}.get(
                 analysis.get("health_label", ""), "#64748b")),
            ("CPU Hote",     f"{host.get('cpu_pct', 0):.1f}%",
             _pct_color(host.get("cpu_pct", 0), 60, 80)),
            ("Memoire Hote", f"{host.get('mem_pct', 0):.1f}%",
             _pct_color(host.get("mem_pct", 0), 70, 85)),
            ("Espace Libre DS", f"{ds.get('free_pct', 0):.1f}%",
             "#dc2626" if ds.get("free_pct", 100) < 10 else
             "#ea580c" if ds.get("free_pct", 100) < 20 else "#16a34a"),
        ]))
        elements.append(Spacer(1, 0.3*cm))

        elements.append(self._kpi_row([
            # FIX — valeur live depuis prometheus["vms"], jamais depuis analysis
            ("VMs allumees", f"{powered_on_count}/{total_vms_count}", vms_color),
            ("SLA Backup (30j)", f"{vg.get('sla_pct', 0):.1f}%",
             "#dc2626" if vg.get("sla_pct", 0) < 50 else
             "#ea580c" if vg.get("sla_pct", 0) < 80 else "#16a34a"),
            ("Jobs Echec", str(vg.get("jobs_failed_count", 0)),
             "#dc2626" if vg.get("jobs_failed_count", 0) > 0 else "#16a34a"),
            ("Erreurs Logs (12h)", str(loki.get("total_errors", 0)),
             "#dc2626" if loki.get("total_errors", 0) > 200 else
             "#ea580c" if loki.get("total_errors", 0) > 50 else "#16a34a"),
            ("Alertes Firing", str(len(firing_alerts)),
             "#dc2626" if len(firing_alerts) > 0 else "#16a34a"),
            ("Alertes Pending", str(len(pending_alerts)),
             "#ea580c" if len(pending_alerts) > 0 else "#16a34a"),
        ]))
        elements.append(Spacer(1, 0.4*cm))

        # FIX — insights live en priorité absolue
        # Les insights LLM (analysis["insights"]) sont filtrés :
        # on supprime TOUS ceux qui parlent de VMs, CPU, RAM, alertes, datastore
        # car ces sujets sont couverts par les insights live (données fraîches).
        # Seuls les insights LLM sur Backup et Logs sont conservés.
        live_insights = self._compute_live_insights(prom)
        llm_insights  = analysis.get("insights", [])
        extra_llm     = [i for i in llm_insights if not _is_live_topic(i)]
        all_insights  = live_insights + extra_llm

        if all_insights:
            elements += self._section_title("Points d'Attention", "⚡")
            level_icon = {
                "CRITICAL": "🔴", "WARNING": "🟡",
                "OK":       "🟢", "INFO":    "🔵", "HIGH": "🟠",
            }
            data = [["Niveau", "Categorie", "Message"]]
            for ins in all_insights:
                lvl  = ins.get("level", "INFO")
                icon = level_icon.get(lvl, "⚪")
                data.append([
                    Paragraph(f"{icon} {lvl}", ParagraphStyle(
                        "il", fontSize=7.5,
                        textColor=_severity_color(lvl),
                        fontName="Helvetica-Bold", leading=10)),
                    Paragraph(ins.get("category", ""), self.style_small),
                    Paragraph(ins.get("message",  ""), self.style_small),
                ])
            t = Table(data, colWidths=[2.2*cm, 2.8*cm, 12*cm])
            t.setStyle(self._table_style_base())
            elements.append(t)

        return elements

    # ─── ESXI HOST SECTION ───────────────────────────────────────────────────

    def _build_esxi_section(self, prom: dict) -> list:
        elements = []
        elements += self._section_title("Infrastructure ESXi - Hote", "🖥️")

        host = prom.get("host", {})

        host_data = [
            ["Parametre",     "Valeur"],
            ["Hote",          host.get("name",         "N/A")],
            ["Processeur",    host.get("cpu_model",     "N/A")],
            ["Version ESXi",  host.get("esxi_version",  "N/A")],
            ["CPUs logiques", str(host.get("num_cpus",  "N/A"))],
            ["CPU Demand",
             f"{host.get('cpu_demand_mhz', 0):.0f} MHz  →  {host.get('cpu_pct', 0):.1f}%"],
            ["CPU Max",          f"{host.get('cpu_max_mhz', 0):.0f} MHz"],
            ["Memoire Max",      f"{host.get('mem_max_mb', 0):.0f} MB"],
            ["Memoire Utilisee",
             f"{host.get('mem_usage_mb', 0):.0f} MB  →  {host.get('mem_pct', 0):.1f}%"],
            ["Mode Maintenance",
             "Oui" if host.get("maintenance_mode") else "Non"],
            ["Etat alimentation",
             "Allume" if host.get("power_state") == 1 else "Eteint"],
        ]
        t = Table(host_data, colWidths=[6*cm, 11*cm])
        t.setStyle(self._table_style_base())
        elements.append(t)
        elements.append(Spacer(1, 0.3*cm))

        try:
            elements.append(self._chart_cpu_mem(prom))
        except Exception as e:
            logger.warning(f"Chart CPU/MEM error: {e}")
        elements.append(Spacer(1, 0.3*cm))

        try:
            elements.append(self._chart_datastore(prom))
        except Exception as e:
            logger.warning(f"Chart datastore error: {e}")

        return elements

    # ─── VMs SECTION ─────────────────────────────────────────────────────────

    def _build_vms_section(self, prom: dict) -> list:
        elements = []
        elements += self._section_title("Machines Virtuelles", "💻")

        vms       = prom.get("vms", {})
        total_vms = len(vms)

        if not vms:
            elements.append(Paragraph(
                "Aucune VM détectée par Prometheus. Vérifier que le vmware_exporter "
                "expose bien les métriques vmware_vm_*.",
                self.style_body,
            ))
            return elements

        # FIX — source unique _count_powered_on() dans toute la section
        powered_on  = _count_powered_on(vms)
        powered_off = total_vms - powered_on
        avg_cpu     = (sum(v.get("cpu_pct", 0) for v in vms.values()
                           if v.get("power_state") == "poweredOn")
                       / max(powered_on, 1))
        avg_mem     = (sum(v.get("mem_pct", 0) for v in vms.values()
                           if v.get("power_state") == "poweredOn")
                       / max(powered_on, 1))
        vms_cpu_alert = sum(1 for v in vms.values() if v.get("cpu_pct", 0) >= 80)
        vms_mem_alert = sum(1 for v in vms.values() if v.get("mem_pct", 0) >= 80)

        elements.append(self._kpi_row([
            ("VMs Total",       str(total_vms),   "#2563eb"),
            ("VMs Allumees",    str(powered_on),  "#16a34a"),
            ("VMs Eteintes",    str(powered_off), "#64748b"),
            ("CPU moy. (ON)",   f"{avg_cpu:.1f}%", _pct_color(avg_cpu, 60, 80)),
            ("RAM moy. (ON)",   f"{avg_mem:.1f}%", _pct_color(avg_mem, 70, 85)),
            ("Alertes CPU/RAM", str(vms_cpu_alert + vms_mem_alert),
             "#dc2626" if (vms_cpu_alert + vms_mem_alert) > 0 else "#16a34a"),
        ]))
        elements.append(Spacer(1, 0.4*cm))

        try:
            chart = self._chart_vms_cpu_mem(vms)
            if chart:
                elements.append(chart)
                elements.append(Spacer(1, 0.3*cm))
        except Exception as e:
            logger.warning(f"Chart VMs CPU/MEM error: {e}")

        try:
            chart_trends = self._chart_vms_trends(vms)
            if chart_trends:
                elements += self._section_title("Évolution CPU par VM (12h)", "📈")
                elements.append(chart_trends)
                elements.append(Spacer(1, 0.3*cm))
        except Exception as e:
            logger.warning(f"Chart VMs trends error: {e}")

        elements += self._section_title("Détail par VM", "📊")

        state_icon = {
            "poweredOn":  "🟢 ON",
            "poweredOff": "⚫ OFF",
            "suspended":  "🟡 SUSP",
        }

        vm_data = [[
            "VM", "État",
            "vCPU", "CPU MHz", "CPU %",
            "RAM MB", "RAM cons. MB", "RAM %",
            "Balloon KB", "Uptime (h)", "Snaps", "Tools",
        ]]

        for vm_name, vm in sorted(vms.items()):
            state_str = state_icon.get(vm.get("power_state", ""), "❓")
            cpu_pct   = vm.get("cpu_pct", 0)
            mem_pct   = vm.get("mem_pct", 0)

            cpu_style = ParagraphStyle(
                "vmcpu", fontSize=7.5, fontName="Helvetica-Bold", leading=10,
                textColor=(C_RED    if cpu_pct >= 90 else
                           C_ORANGE if cpu_pct >= 70 else C_GREEN),
                alignment=TA_CENTER,
            )
            mem_style = ParagraphStyle(
                "vmmem", fontSize=7.5, fontName="Helvetica-Bold", leading=10,
                textColor=(C_RED    if mem_pct >= 90 else
                           C_ORANGE if mem_pct >= 75 else C_GREEN),
                alignment=TA_CENTER,
            )
            tools      = vm.get("tools_status", "unknown")
            tools_icon = "✅" if tools == "toolsOk" else "❌"

            vm_data.append([
                Paragraph(vm_name[:20], ParagraphStyle(
                    "vmn", fontSize=7.5, fontName="Helvetica-Bold",
                    textColor=C_BLUE_DARK, leading=10)),
                Paragraph(state_str, ParagraphStyle(
                    "vms", fontSize=7, fontName="Helvetica", leading=10)),
                str(int(vm.get("num_cpus", 0))),
                f"{vm.get('cpu_demand_mhz', 0):.0f}",
                Paragraph(f"{cpu_pct:.1f}%", cpu_style),
                f"{vm.get('mem_size_mb', 0):.0f}",
                f"{vm.get('mem_usage_mb', 0):.0f}",
                Paragraph(f"{mem_pct:.1f}%", mem_style),
                f"{vm.get('mem_balloon_kb', 0):.0f}",
                f"{vm.get('uptime_hours', 0):.1f}",
                str(vm.get("snapshots", 0)),
                tools_icon,
            ])

        t_vms = Table(vm_data, colWidths=[
            2.8*cm, 1.5*cm,
            1.0*cm, 1.6*cm, 1.3*cm,
            1.8*cm, 2.0*cm, 1.3*cm,
            1.8*cm, 1.6*cm, 1.0*cm, 1.3*cm,
        ])
        t_vms.setStyle(self._table_style_base())

        for row_idx, (vm_name, vm) in enumerate(sorted(vms.items()), start=1):
            cpu_pct = vm.get("cpu_pct", 0)
            mem_pct = vm.get("mem_pct", 0)
            if cpu_pct >= 90 or mem_pct >= 90:
                t_vms.setStyle(TableStyle([
                    ("BACKGROUND", (0, row_idx), (-1, row_idx), C_RED_LIGHT)
                ]))
            elif cpu_pct >= 70 or mem_pct >= 75:
                t_vms.setStyle(TableStyle([
                    ("BACKGROUND", (0, row_idx), (-1, row_idx), C_ORANGE_LIGHT)
                ]))

        elements.append(t_vms)
        elements.append(Spacer(1, 0.3*cm))

        try:
            chart_io = self._chart_vms_io(vms)
            if chart_io:
                elements += self._section_title("I/O Disque & Réseau par VM", "📡")
                elements.append(chart_io)
                elements.append(Spacer(1, 0.3*cm))
        except Exception as e:
            logger.warning(f"Chart VMs I/O error: {e}")

        powered_on_vms = {n: v for n, v in vms.items()
                          if v.get("power_state") == "poweredOn"}
        if powered_on_vms:
            elements += self._section_title(
                "Réseau & Stockage (VMs allumées)", "🌐"
            )
            io_data = [["VM", "Disk Read KB/s", "Disk Write KB/s",
                        "Net RX KB/s", "Net TX KB/s",
                        "Disk / (GB libre)", "Mem Swap KB"]]
            for vm_name, vm in sorted(powered_on_vms.items()):
                disk_info = (
                    f"{vm.get('guest_disk_free_gb', 0):.1f} / "
                    f"{vm.get('guest_disk_cap_gb', 0):.1f}"
                    if vm.get("guest_disk_cap_gb", 0) > 0 else "N/A"
                )
                io_data.append([
                    Paragraph(vm_name[:20], ParagraphStyle(
                        "iovmn", fontSize=7.5, fontName="Helvetica-Bold",
                        textColor=C_BLUE_DARK, leading=10)),
                    f"{vm.get('disk_read_kbs',  0):.1f}",
                    f"{vm.get('disk_write_kbs', 0):.1f}",
                    f"{vm.get('net_rx_kbs',     0):.1f}",
                    f"{vm.get('net_tx_kbs',     0):.1f}",
                    disk_info,
                    f"{vm.get('mem_swapped_kb', 0):.0f}",
                ])
            t_io = Table(io_data,
                         colWidths=[2.8*cm, 2.5*cm, 2.5*cm,
                                    2.5*cm, 2.5*cm, 2.8*cm, 2.4*cm])
            t_io.setStyle(self._table_style_base())
            elements.append(t_io)

        balloon_vms = {n: v for n, v in vms.items()
                       if v.get("mem_balloon_kb", 0) > 102400}
        if balloon_vms:
            elements.append(Spacer(1, 0.3*cm))
            elements += self._section_title(
                "VMs avec Pression Mémoire (Balloon > 100 MB)", "🔴"
            )
            balloon_data = [["VM", "Balloon KB", "Swap KB",
                             "RAM %", "Recommandation"]]
            for vm_name, vm in sorted(balloon_vms.items()):
                balloon_data.append([
                    Paragraph(vm_name[:20], self.style_bold),
                    f"{vm.get('mem_balloon_kb', 0):.0f}",
                    f"{vm.get('mem_swapped_kb', 0):.0f}",
                    f"{vm.get('mem_pct', 0):.1f}%",
                    Paragraph(
                        "Augmenter la RAM provisionnée ou libérer "
                        "de la mémoire sur l'hôte.",
                        self.style_small,
                    ),
                ])
            t_bal = Table(balloon_data,
                          colWidths=[3.5*cm, 2.5*cm, 2.5*cm, 1.8*cm, 7.7*cm])
            t_bal.setStyle(self._table_style_base(header_color=C_ORANGE))
            elements.append(t_bal)

        return elements

    # ─── BACKUP SECTION ──────────────────────────────────────────────────────

    def _build_backup_section(self, veeam: dict) -> list:
        elements = []
        elements += self._section_title("Sauvegardes Veeam", "💾")

        g = veeam.get("global", {})
        elements.append(self._kpi_row([
            ("SLA Global", f"{g.get('sla_pct', 0):.1f}%",
             "#dc2626" if g.get("sla_pct", 0) < 50 else
             "#ea580c" if g.get("sla_pct", 0) < 80 else "#16a34a"),
            ("Sessions (30j)", str(g.get("total_sessions_30d", 0)), "#2563eb"),
            ("Succes (30j)",   str(g.get("total_success_30d",  0)), "#16a34a"),
            ("Echecs (30j)",   str(g.get("total_failed_30d",   0)),
             "#dc2626" if g.get("total_failed_30d", 0) > 0 else "#16a34a"),
            ("RPO Max",   g.get("rpo_worst_human", "N/A"),
             "#dc2626" if g.get("rpo_worst_minutes", 0) > 20160 else
             "#ea580c" if g.get("rpo_worst_minutes", 0) > 10080 else "#16a34a"),
            ("RTO Moyen", g.get("rto_avg_human", "N/A"), "#7c3aed"),
        ]))
        elements.append(Spacer(1, 0.3*cm))

        try:
            chart = self._chart_backup_sla(veeam)
            if chart:
                elements.append(chart)
        except Exception as e:
            logger.warning(f"Chart backup error: {e}")
        elements.append(Spacer(1, 0.3*cm))

        jobs = veeam.get("jobs", [])
        if jobs:
            status_icon = {"success": "✅", "failed": "❌",
                           "warning": "⚠️", "unknown": "❓"}
            job_data = [["Job", "Statut", "Dernier Resultat",
                         "RPO", "RTO", "SLA 30j"]]
            for job in jobs:
                stat = job.get("status", "unknown")
                icon = status_icon.get(stat, "❓")
                job_data.append([
                    Paragraph(job.get("job_name", "N/A")[:25], self.style_small),
                    Paragraph(f"{icon} {stat.upper()}", ParagraphStyle(
                        "js", fontSize=7.5, fontName="Helvetica-Bold",
                        textColor={"success": C_GREEN, "failed": C_RED,
                                   "warning": C_YELLOW, "unknown": C_GRAY}.get(
                            stat, C_GRAY))),
                    job.get("last_result", "N/A"),
                    job.get("rpo_human",   "N/A"),
                    job.get("rto_human",   "N/A"),
                    f"{job.get('sla_pct', 0):.1f}%",
                ])
            t = Table(job_data,
                      colWidths=[4*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2*cm, 3.5*cm])
            t.setStyle(self._table_style_base())
            elements.append(t)

        risk_jobs = veeam.get("risk_jobs", [])
        if risk_jobs:
            elements.append(Spacer(1, 0.3*cm))
            elements += self._section_title("Jobs a Risque", "⚠️")
            risk_data = [["Job", "RPO", "Raison"]]
            for rj in risk_jobs:
                risk_data.append([
                    rj.get("job",    "N/A"),
                    rj.get("rpo",    "N/A"),
                    Paragraph(rj.get("reason", ""), self.style_small),
                ])
            t2 = Table(risk_data, colWidths=[4*cm, 3*cm, 10*cm])
            t2.setStyle(self._table_style_base(header_color=C_RED))
            elements.append(t2)

        return elements

    # ─── LOGS SECTION ────────────────────────────────────────────────────────

    def _build_logs_section(self, loki: dict, signoz: dict) -> list:
        elements = []
        elements += self._section_title("Logs & Alertes", "📊")

        elements.append(self._kpi_row([
            ("Logs Total (12h)", str(loki.get("total_logs",     0)), "#2563eb"),
            ("Erreurs",  str(loki.get("total_errors",   0)),
             "#dc2626" if loki.get("total_errors",   0) > 100 else "#16a34a"),
            ("Warnings", str(loki.get("total_warnings", 0)),
             "#ea580c" if loki.get("total_warnings", 0) > 50  else "#16a34a"),
            ("Critiques", str(loki.get("total_critical", 0)),
             "#dc2626" if loki.get("total_critical", 0) > 5   else "#16a34a"),
            ("Alertes Signoz", str(signoz.get("total_alerts", 0)),
             "#dc2626" if signoz.get("firing", 0) > 0 else "#16a34a"),
        ]))
        elements.append(Spacer(1, 0.3*cm))

        try:
            elements.append(self._chart_logs_errors(loki))
        except Exception as e:
            logger.warning(f"Chart logs error: {e}")
        elements.append(Spacer(1, 0.3*cm))

        top_errors = loki.get("top_errors", [])
        if top_errors:
            elements += self._section_title("Erreurs les Plus Frequentes", "🔴")
            err_data = [["Message", "Occurrences"]]
            for err in top_errors[:10]:
                err_data.append([
                    Paragraph(err.get("message", "")[:100], self.style_small),
                    str(err.get("count", 0)),
                ])
            t = Table(err_data, colWidths=[14*cm, 3*cm])
            t.setStyle(self._table_style_base(header_color=C_RED))
            elements.append(t)

        recent_crit = loki.get("recent_critical", [])
        if recent_crit:
            elements.append(Spacer(1, 0.3*cm))
            elements += self._section_title("Logs Critiques Recents", "🚨")
            crit_data = [["Timestamp", "Message"]]
            for log in recent_crit[:10]:
                crit_data.append([
                    log.get("timestamp", "")[:16],
                    Paragraph(log.get("message", "")[:120], self.style_small),
                ])
            t2 = Table(crit_data, colWidths=[4*cm, 13*cm])
            t2.setStyle(self._table_style_base(header_color=C_ORANGE))
            elements.append(t2)

        signoz_firing = signoz.get("firing_alerts", [])
        if signoz_firing:
            elements.append(Spacer(1, 0.3*cm))
            elements += self._section_title("Alertes Signoz Actives", "🔔")
            sig_data = [["Nom Alerte", "Severite", "Etat"]]
            for alert in signoz_firing[:15]:
                labels = alert.get("labels", {})
                sig_data.append([
                    labels.get("alertname", alert.get("name", "N/A")),
                    labels.get("severity", "N/A"),
                    alert.get("state", "N/A"),
                ])
            t3 = Table(sig_data, colWidths=[7*cm, 5*cm, 5*cm])
            t3.setStyle(self._table_style_base())
            elements.append(t3)

        return elements

    # ─── CORRELATIONS SECTION ────────────────────────────────────────────────

    def _build_correlations_section(self, analysis: dict) -> list:
        elements = []
        elements.append(Spacer(1, 0.4*cm))
        elements += self._section_title(
            "Analyse de Correlation Intelligente", "🧠"
        )

        correlations = analysis.get("correlations", [])
        if not correlations:
            elements.append(Paragraph(
                "Aucune corrélation anormale détectée.", self.style_body
            ))
            return elements

        sev_color  = {"CRITICAL": C_RED_LIGHT,   "HIGH": C_ORANGE_LIGHT,
                      "WARNING":  C_YELLOW_LIGHT, "OK":  C_GREEN_LIGHT}
        sev_border = {"CRITICAL": C_RED,   "HIGH": C_ORANGE,
                      "WARNING":  C_YELLOW, "OK":  C_GREEN}
        sev_icon   = {"CRITICAL": "🔴", "HIGH": "🟠",
                      "WARNING":  "🟡", "OK":   "🟢"}

        for corr in correlations:
            sev    = corr.get("severity", "INFO")
            icon   = sev_icon.get(sev, "⚪")
            bg     = sev_color.get(sev, C_GRAY_LIGHT)
            border = sev_border.get(sev, C_GRAY)

            msg_style = ParagraphStyle(
                "corr_msg", fontSize=9, fontName="Helvetica", leading=13,
                textColor=colors.HexColor("#1e293b"), leftIndent=5,
            )
            type_style = ParagraphStyle(
                "corr_type", fontSize=7.5, fontName="Helvetica-Bold",
                textColor=C_GRAY, leading=10,
            )

            row = Table([[
                Paragraph(f"{icon} {corr.get('type', '')}", type_style),
                Paragraph(corr.get("message", ""), msg_style),
            ]], colWidths=[2.5*cm, 14.5*cm])
            row.setStyle(TableStyle([
                ("BACKGROUND",     (0, 0), (-1, -1), bg),
                ("BOX",            (0, 0), (-1, -1), 1, border),
                ("TOPPADDING",     (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING",  (0, 0), (-1, -1), 8),
                ("LEFTPADDING",    (0, 0), (-1, -1), 10),
                ("RIGHTPADDING",   (0, 0), (-1, -1), 10),
                ("VALIGN",         (0, 0), (-1, -1), "MIDDLE"),
                ("ROUNDEDCORNERS", [5, 5, 5, 5]),
            ]))
            elements.append(row)
            elements.append(Spacer(1, 0.2*cm))

        return elements

