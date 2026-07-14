"""
Calibración del Scoring — Analiza proyectos open-source de referencia
para validar y ajustar los umbrales de scoring de DebtRadar.

Uso: python calibrate_scoring.py
"""

import sys
import os
import json
import subprocess
import tempfile
import shutil
from pathlib import Path

# Agregar el directorio backend al path
sys.path.insert(0, str(Path(__file__).parent))

from analyzer.scanner import discover_files
from analyzer.orchestrator import safe_process_file
from analyzer.metrics import aggregate_results, get_grade

# === Proyectos de referencia ===
# Formato: (url, nombre, grado_esperado, descripción)
REFERENCE_PROJECTS = [
    # Excellent (esperado: A)
    ("https://github.com/pallets/click.git", "click", "A", "CLI framework, well-structured"),
    ("https://github.com/pallets/markupsafe.git", "markupsafe", "A", "Small, clean utility"),

    # Good (esperado: B)
    ("https://github.com/pallets/flask.git", "flask", "B", "Web framework, moderate complexity"),
    ("https://github.com/psf/requests.git", "requests", "B", "HTTP library, well-maintained"),

    # Large/Complex (esperado: C or D)
    ("https://github.com/django/django.git", "django", "C", "Large framework, high complexity"),
    ("https://github.com/tensorflow/tensorflow.git", "tensorflow", "D", "Massive, very complex"),
]

# Rango aceptable por grado esperado
ACCEPTABLE_RANGES = {
    "A": ["A", "B"],          # A acepta A o B
    "B": ["A", "B", "C"],     # B acepta A, B o C
    "C": ["B", "C", "D"],     # C acepta B, C o D
    "D": ["C", "D", "F"],     # D acepta C, D o F
    "F": ["D", "F"],          # F acepta D o F
}


def clone_repo(url: str, name: str, target_dir: str) -> str:
    """Clona un repositorio en el directorio destino."""
    repo_path = os.path.join(target_dir, name)
    if os.path.exists(repo_path):
        return repo_path

    print(f"  📥 Clonando {name}...")
    result = subprocess.run(
        ["git", "clone", "--depth=1", url, repo_path],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if result.returncode != 0:
        print(f"  ❌ Error clonando {name}: {result.stderr[:100]}")
        return None
    return repo_path


def analyze_repo(repo_path: str, max_files: int = 200) -> dict:
    """Analiza un repositorio y retorna el summary."""
    file_paths, skipped = discover_files(repo_path)
    if not file_paths:
        return None

    file_paths = file_paths[:max_files]

    results = []
    for fp in file_paths:
        result = safe_process_file(fp)
        if not result.get("skipped"):
            results.append(result)

    if not results:
        return None

    agg = aggregate_results(results, skipped, 0, 1)
    return agg["summary"]


def calibrate():
    """Ejecuta la calibración completa."""
    print("═══════════════════════════════════════════════")
    print("  📊 Calibración del Scoring — DebtRadar")
    print("═══════════════════════════════════════════════\n")

    target_dir = tempfile.mkdtemp(prefix="debtradar_cal_")
    results = []
    correct = 0
    total = 0

    try:
        for url, name, expected, desc in REFERENCE_PROJECTS:
            print(f"\n▶ {name} ({desc})")
            print(f"  Esperado: {expected}")

            # Clonar
            repo_path = clone_repo(url, name, target_dir)
            if not repo_path:
                results.append({
                    "name": name, "expected": expected,
                    "actual": "?", "score": 0, "correct": False, "error": "Clone failed",
                })
                continue

            # Analizar
            summary = analyze_repo(repo_path)
            if not summary:
                results.append({
                    "name": name, "expected": expected,
                    "actual": "?", "score": 0, "correct": False, "error": "No files found",
                })
                continue

            grade = summary["grade"]
            score = summary["average_score"]
            acceptable = ACCEPTABLE_RANGES.get(expected, [])
            is_correct = grade in acceptable

            total += 1
            if is_correct:
                correct += 1

            status = "✅" if is_correct else "❌"
            print(f"  Resultado: {grade} (score {score}) {status}")
            print(f"  Aceptable: {acceptable}")

            results.append({
                "name": name,
                "expected": expected,
                "actual": grade,
                "score": score,
                "total_files": summary["total_files"],
                "total_lines": summary["total_lines"],
                "correct": is_correct,
            })

    finally:
        # Limpiar repos clonados
        shutil.rmtree(target_dir, ignore_errors=True)

    # Resumen
    accuracy = (correct / total * 100) if total > 0 else 0

    print("\n═══════════════════════════════════════════════")
    print(f"  RESUMEN: {correct}/{total} correctos ({accuracy:.0f}%)")
    print("═══════════════════════════════════════════════\n")

    for r in results:
        status = "✅" if r["correct"] else "❌"
        print(f"  {status} {r['name']:15s} | esperado: {r['expected']} | actual: {r['actual']} ({r.get('score', 0)})")

    # Guardar resultados
    output_path = os.path.join(os.path.dirname(__file__), "calibration_results.json")
    with open(output_path, "w") as f:
        json.dump({
            "accuracy": accuracy,
            "correct": correct,
            "total": total,
            "results": results,
        }, f, indent=2)
    print(f"\n📄 Resultados guardados en: {output_path}")

    # Recomendaciones
    if accuracy < 80:
        print("\n⚠️  Precisión < 80%. Considera ajustar los umbrales en metrics.py:")
        print("    - Si proyectos 'buenos' obtienen D/F: relajar umbrales")
        print("    - Si proyectos 'malos' obtienen A/B: endurecer umbrales")
    else:
        print("\n✅ Precisión >= 80%. Los umbrales están bien calibrados.")

    return accuracy


if __name__ == "__main__":
    calibrate()
