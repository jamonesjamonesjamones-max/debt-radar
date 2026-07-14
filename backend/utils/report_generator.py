"""
Report Generator — Genera reportes HTML autocontenidos con Jinja2.
"""

import os
from datetime import datetime
from jinja2 import Environment, FileSystemLoader

from analyzer.metrics import get_grade


def generate_html_report(summary: dict, files: list, skipped_files: list) -> str:
    """
    Genera un reporte HTML autocontenido con los resultados del escaneo.
    Retorna el HTML como string.
    """
    # Preparar datos para el template
    violations_by_type = summary.get("violations_by_type", {})
    violation_labels = list(violations_by_type.keys())
    violation_values = list(violations_by_type.values())

    # Labels legibles
    readable_labels = {
        "max_nesting": "Nesting",
        "magic_number": "Magic Numbers",
        "todo": "TODOs",
    }
    violation_labels = [readable_labels.get(l, l) for l in violation_labels]

    # Grade distribution
    grade_dist = summary.get("grade_distribution", {})
    grade_values = [grade_dist.get(g, 0) for g in ["A", "B", "C", "D", "F"]]

    # Radar data (complexity, todos, magic, god files)
    total = max(len(files), 1)
    complexity_avg = sum(abs(f.get("deductions", {}).get("complexity", 0)) for f in files) / total
    todos_avg = sum(abs(f.get("deductions", {}).get("todos", 0)) for f in files) / total
    magic_avg = sum(abs(f.get("deductions", {}).get("magic_numbers", 0)) for f in files) / total
    god_files = sum(1 for f in files if f.get("lines", 0) > 500)
    god_ratio = (god_files / total) * 100

    radar_labels = ["Complejidad", "TODOs", "Magic Numbers", "Archivos Dios"]
    radar_values = [
        min(round((complexity_avg / 30) * 100), 100),
        min(round((todos_avg / 20) * 100), 100),
        min(round((magic_avg / 25) * 100), 100),
        round(god_ratio),
    ]

    # Top offenders
    sorted_files = sorted(files, key=lambda x: x.get("score", 100))
    top_offenders = []
    for f in sorted_files[:10]:
        score = f.get("score", 0)
        grade, _ = get_grade(score)
        path = f.get("path", "")
        short_path = "/".join(path.split("/")[-3:]) if "/" in path else path
        top_offenders.append({
            "score": score,
            "grade": grade,
            "lines": f.get("lines", 0),
            "violations": len(f.get("violations", [])),
            "short_path": short_path,
        })

    # Render template
    template_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
    env = Environment(loader=FileSystemLoader(template_dir))
    template = env.get_template("report.html")

    html = template.render(
        summary=summary,
        top_offenders=top_offenders,
        radar_labels=radar_labels,
        radar_values=radar_values,
        violation_labels=violation_labels,
        violation_values=violation_values,
        grade_values=grade_values,
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M"),
    )

    return html
