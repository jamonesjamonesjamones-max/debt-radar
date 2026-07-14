"""
Orchestrator: ProcessPoolExecutor + AST analysis + scoring.
Seguridad: timeout por archivo, cancellation support.
Performance: initializer para parsers, single file read.
"""

import os
import time
from concurrent.futures import ProcessPoolExecutor, as_completed, TimeoutError, CancelledError
from typing import Any

from parsers.ast_analyzer import analyze_file
from analyzer.metrics import calculate_file_score

EXTENSION_MAP = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
}


def _worker_init():
    """Initializer: precarga parsers Tree-sitter una vez por worker."""
    import parsers.parser_pool  # noqa: F401


def safe_process_file(filepath: str) -> dict[str, Any]:
    """Procesa un archivo individual de forma segura."""
    try:
        _, ext = os.path.splitext(filepath)
        language = EXTENSION_MAP.get(ext.lower(), "unknown")

        ast_metrics = analyze_file(filepath)

        if ast_metrics is None:
            try:
                with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                    line_count = len(f.read().split("\n"))
            except FileNotFoundError:
                return {
                    "path": filepath, "lines": 0, "score": 0, "language": "unknown",
                    "deductions": {"file_size": 0, "complexity": 0, "todos": 0, "magic_numbers": 0, "function_complexity": 0},
                    "violations": [], "skipped": True, "reason": "File not found",
                }
            except Exception:
                line_count = 0

            return {
                "path": filepath, "lines": line_count, "score": 100, "language": language,
                "deductions": {"file_size": 0, "complexity": 0, "todos": 0, "magic_numbers": 0, "function_complexity": 0},
                "violations": [],
            }

        score_result = calculate_file_score(ast_metrics)

        return {
            "path": filepath,
            "lines": ast_metrics["lines"],
            "score": score_result["score"],
            "language": language,
            "deductions": score_result["deductions"],
            "violations": ast_metrics["violations"],
        }

    except PermissionError:
        return {
            "path": filepath, "lines": 0, "score": 0, "language": "unknown",
            "deductions": {"file_size": 0, "complexity": 0, "todos": 0, "magic_numbers": 0, "function_complexity": 0},
            "violations": [], "skipped": True, "reason": "Permission denied",
        }
    except FileNotFoundError:
        return {
            "path": filepath, "lines": 0, "score": 0, "language": "unknown",
            "deductions": {"file_size": 0, "complexity": 0, "todos": 0, "magic_numbers": 0, "function_complexity": 0},
            "violations": [], "skipped": True, "reason": "File not found",
        }
    except Exception as e:
        return {
            "path": filepath, "lines": 0, "score": 0, "language": "unknown",
            "deductions": {"file_size": 0, "complexity": 0, "todos": 0, "magic_numbers": 0, "function_complexity": 0},
            "violations": [], "skipped": True, "reason": f"Error: {type(e).__name__}",
        }


def run_scan_job(
    job_id: str,
    file_paths: list[str],
    worker_count: int,
    active_jobs: dict,
    timeout_per_file: int = 30,
) -> None:
    """Ejecuta el escaneo completo con análisis AST real."""
    job = active_jobs.get(job_id)
    if not job:
        return

    total_files = len(file_paths)
    job["total_files"] = total_files
    start_time = job.get("start_time", time.time())

    results = []
    skipped = []

    try:
        if worker_count <= 1:
            for i, filepath in enumerate(file_paths):
                if job.get("status") == "cancelled":
                    break

                result = safe_process_file(filepath)
                job["files_completed"] = i + 1
                job["progress"] = ((i + 1) / total_files) * 100
                job["elapsed"] = time.time() - start_time
                job["current_file"] = filepath

                if result.get("skipped"):
                    skipped.append(result)
                else:
                    results.append(result)
        else:
            with ProcessPoolExecutor(
                max_workers=worker_count,
                initializer=_worker_init,
            ) as executor:
                futures = {
                    executor.submit(safe_process_file, f): f for f in file_paths
                }

                completed_count = 0
                try:
                    for future in as_completed(futures, timeout=timeout_per_file * total_files):
                        # Early termination: cancelar si el job fue cancelado
                        if job.get("status") == "cancelled":
                            for f in futures:
                                f.cancel()
                            break

                        filepath = futures[future]
                        completed_count += 1

                        try:
                            result = future.result(timeout=timeout_per_file)
                        except TimeoutError:
                            result = {
                                "path": filepath, "lines": 0, "score": 0, "language": "unknown",
                                "deductions": {"file_size": 0, "complexity": 0, "todos": 0, "magic_numbers": 0, "function_complexity": 0},
                                "violations": [], "skipped": True, "reason": f"Timeout ({timeout_per_file}s)",
                            }
                        except CancelledError:
                            break
                        except Exception:
                            result = {
                                "path": filepath, "lines": 0, "score": 0, "language": "unknown",
                                "deductions": {"file_size": 0, "complexity": 0, "todos": 0, "magic_numbers": 0, "function_complexity": 0},
                                "violations": [], "skipped": True, "reason": "Worker error",
                            }

                        job["files_completed"] = completed_count
                        job["progress"] = (completed_count / total_files) * 100
                        job["elapsed"] = time.time() - start_time
                        job["current_file"] = filepath

                        if result.get("skipped"):
                            skipped.append(result)
                        else:
                            results.append(result)
                except TimeoutError:
                    pass  # Timeout global alcanzado

        # Marcar el análisis en bruto como terminado (solo si no fue cancelado).
        # IMPORTANTE: NO se marca como "completed" aquí todavía. El resultado aún
        # no tiene el campo "summary" (eso lo agrega _run_real_scan con
        # aggregate_results). Si expusiéramos "completed" en este punto, el SSE
        # stream (que sondea active_jobs de forma independiente) podría leer y
        # enviar este resultado incompleto al frontend antes de que se agregue,
        # cerrando la conexión sin reintentar. Usamos "aggregating" como estado
        # intermedio: el stream lo trata igual que "running" (sigue esperando).
        if job.get("status") != "cancelled":
            job["elapsed"] = time.time() - start_time
            job["progress"] = 100.0
            job["status"] = "aggregating"
            job["current_file"] = ""
            job["result"] = {
                "files": results,
                "skipped_files": skipped,
            }

    except Exception as e:
        job["status"] = "error"
        job["error"] = f"{type(e).__name__}: {str(e)[:200]}"
