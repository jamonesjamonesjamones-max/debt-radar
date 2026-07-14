"""
Metrics: Sistema de scoring centralizado.
- Score por archivo (base 100, deducciones enteras)
- Score del repositorio (ponderado por líneas)
- Agregación completa con summary enriquecido
"""

from typing import Any

# === Umbrales de grado ===
GRADE_THRESHOLDS = [
    (90, "A", "Clean Code"),
    (75, "B", "Minor Debt"),
    (60, "C", "High Debt"),
    (40, "D", "Fragile Code"),
    (0,  "F", "Biohazard"),
]


def get_grade(score: int) -> tuple[str, str]:
    """Retorna (letra, label) para un score dado."""
    for threshold, letter, label in GRADE_THRESHOLDS:
        if score >= threshold:
            return letter, label
    return "F", "Biohazard"


def calculate_file_score(file_metrics: dict) -> dict:
    """
    Calcula el score de un archivo (base 100) con deducciones enteras.

    Args:
        file_metrics: dict con keys: lines, max_nesting, max_function_branches,
                      todos, magic_numbers_suspicious

    Returns:
        dict con 'score' (int) y 'deductions' (dict[str, int])
    """
    score = 100
    deductions = {
        "file_size": 0,
        "complexity": 0,
        "todos": 0,
        "magic_numbers": 0,
        "function_complexity": 0,
    }

    lines = max(file_metrics.get("lines", 1), 1)

    # === 1. Archivos Dios (EXCLUYENTE con elif) ===
    if lines > 1000:
        deductions["file_size"] = -40
    elif lines > 500:
        deductions["file_size"] = -20

    # === 2. Complejidad por NESTING (EXCLUYENTE) ===
    nesting = file_metrics.get("max_nesting", 0)
    if nesting > 6:
        deductions["complexity"] = -30
    elif nesting > 4:
        deductions["complexity"] = -15

    # === 3. TODOs NORMALIZADOS (por cada 100 líneas, techo -20) ===
    todos = file_metrics.get("todos", 0)
    todos_per_100 = (todos / lines) * 100
    deductions["todos"] = int(max(todos_per_100 * -2, -20))

    # === 4. Magic Numbers NORMALIZADOS (por cada 100 líneas, techo -25) ===
    magic = file_metrics.get("magic_numbers_suspicious", 0)
    magic_per_100 = (magic / lines) * 100
    deductions["magic_numbers"] = int(max(magic_per_100 * -3, -25))

    # === 5. Complejidad Ciclomática POR FUNCIÓN (no total) ===
    max_func_branches = file_metrics.get("max_function_branches", 0)
    if max_func_branches > 15:
        deductions["function_complexity"] = -25
    elif max_func_branches > 10:
        deductions["function_complexity"] = -10

    # Aplicar deducciones y piso en 0
    score += sum(deductions.values())
    score = max(0, score)

    return {"score": int(score), "deductions": deductions}


def aggregate_results(
    files: list[dict[str, Any]],
    skipped_files: list[dict[str, Any]],
    scan_time: float,
    workers_used: int,
) -> dict[str, Any]:
    """
    Agrega resultados de todos los archivos y genera el summary completo.

    Args:
        files: lista de resultados por archivo (con score, lines, violations, etc.)
        skipped_files: lista de archivos omitidos
        scan_time: tiempo total de escaneo en segundos
        workers_used: número de workers utilizados

    Returns:
        dict con 'summary', 'files', 'skipped_files'
    """
    if not files:
        return {
            "summary": _empty_summary(scan_time, workers_used, len(skipped_files)),
            "files": [],
            "skipped_files": skipped_files,
        }

    # === Métricas básicas ===
    total_files = len(files)
    total_lines = sum(f.get("lines", 0) for f in files)

    # === Score promedio ponderado por líneas ===
    if total_lines > 0:
        weighted_sum = sum(f.get("score", 0) * f.get("lines", 0) for f in files)
        average_score = int(round(weighted_sum / total_lines))
    else:
        average_score = 0

    grade, grade_label = get_grade(average_score)

    # === Conteo de violaciones por tipo ===
    violations_by_type: dict[str, int] = {}
    total_violations = 0
    for f in files:
        for v in f.get("violations", []):
            vtype = v.get("type", "unknown")
            violations_by_type[vtype] = violations_by_type.get(vtype, 0) + 1
            total_violations += 1

    # === Distribución de grados ===
    grade_distribution = {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
    for f in files:
        g, _ = get_grade(f.get("score", 0))
        grade_distribution[g] += 1

    # === Top offenders (5 peores archivos) ===
    sorted_files = sorted(files, key=lambda x: x.get("score", 100))
    top_offenders = [
        {
            "path": f.get("path", ""),
            "score": f.get("score", 0),
            "lines": f.get("lines", 0),
            "violations": len(f.get("violations", [])),
        }
        for f in sorted_files[:5]
    ]

    # === Summary completo ===
    summary = {
        "total_files": total_files,
        "total_lines": total_lines,
        "average_score": average_score,
        "grade": grade,
        "grade_label": grade_label,
        "scan_time_seconds": round(scan_time, 2),
        "workers_used": workers_used,
        "files_skipped": len(skipped_files),
        "total_violations": total_violations,
        "violations_by_type": violations_by_type,
        "grade_distribution": grade_distribution,
        "top_offenders": top_offenders,
    }

    return {
        "summary": summary,
        "files": files,
        "skipped_files": skipped_files,
    }


def _empty_summary(scan_time: float, workers: int, skipped: int) -> dict:
    """Summary para cuando no hay archivos analizados."""
    return {
        "total_files": 0,
        "total_lines": 0,
        "average_score": 0,
        "grade": "F",
        "grade_label": "Biohazard",
        "scan_time_seconds": round(scan_time, 2),
        "workers_used": workers,
        "files_skipped": skipped,
        "total_violations": 0,
        "violations_by_type": {},
        "grade_distribution": {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0},
        "top_offenders": [],
    }
