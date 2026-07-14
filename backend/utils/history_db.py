"""
History DB — Tracking histórico de escaneos con SQLite.
Almacena resultados en ~/.debtradar/history.db
"""

import os
import sqlite3
import json
from datetime import datetime
from typing import Optional


DB_DIR = os.path.expanduser("~/.debtradar")
DB_PATH = os.path.join(DB_DIR, "history.db")
_db_initialized = False


def _get_connection() -> sqlite3.Connection:
    """Obtiene conexión a la base de datos, creando el directorio si es necesario."""
    os.makedirs(DB_DIR, mode=0o700, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        os.chmod(DB_PATH, 0o600)
    except OSError:
        pass
    return conn


def init_db():
    """Inicializa la base de datos creando la tabla si no existe."""
    global _db_initialized
    if _db_initialized:
        return
    conn = _get_connection()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL,
                grade TEXT NOT NULL,
                score INTEGER NOT NULL,
                total_files INTEGER NOT NULL,
                total_lines INTEGER NOT NULL,
                total_violations INTEGER NOT NULL,
                scan_time_seconds REAL NOT NULL,
                violations_by_type TEXT,
                grade_distribution TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_scans_path ON scans(path)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_scans_created ON scans(created_at)
        """)
        conn.commit()
        _db_initialized = True
    finally:
        conn.close()


def save_scan(summary: dict, path: str):
    """
    Guarda un escaneo en la base de datos.
    Inicializa la DB si es necesario.
    """
    init_db()
    conn = _get_connection()
    try:
        conn.execute(
            """INSERT INTO scans 
               (path, grade, score, total_files, total_lines, total_violations, 
                scan_time_seconds, violations_by_type, grade_distribution)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                path,
                summary.get("grade", "F"),
                summary.get("average_score", 0),
                summary.get("total_files", 0),
                summary.get("total_lines", 0),
                summary.get("total_violations", 0),
                summary.get("scan_time_seconds", 0),
                json.dumps(summary.get("violations_by_type", {})),
                json.dumps(summary.get("grade_distribution", {})),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def get_scan_history(path: str, limit: int = 10) -> list[dict]:
    """
    Obtiene el historial de escaneos para un path dado.
    Retorna lista de dicts ordenados por fecha (más reciente primero).
    """
    init_db()
    conn = _get_connection()
    try:
        rows = conn.execute(
            """SELECT * FROM scans 
               WHERE path = ? 
               ORDER BY created_at DESC 
               LIMIT ?""",
            (path, limit),
        ).fetchall()

        results = []
        for row in rows:
            results.append({
                "id": row["id"],
                "path": row["path"],
                "grade": row["grade"],
                "score": row["score"],
                "total_files": row["total_files"],
                "total_lines": row["total_lines"],
                "total_violations": row["total_violations"],
                "scan_time_seconds": row["scan_time_seconds"],
                "violations_by_type": json.loads(row["violations_by_type"] or "{}"),
                "grade_distribution": json.loads(row["grade_distribution"] or "{}"),
                "created_at": row["created_at"],
            })
        return results
    finally:
        conn.close()


def get_last_scan(path: str) -> Optional[dict]:
    """
    Obtiene el último escaneo para un path dado.
    Retorna dict o None si no hay escaneos previos.
    """
    history = get_scan_history(path, limit=1)
    return history[0] if history else None


def compare_with_last(current_summary: dict, path: str) -> Optional[dict]:
    """
    Compara el escaneo actual con el último escaneo guardado.
    Retorna dict con diffs o None si no hay escaneos previos.
    """
    last = get_last_scan(path)
    if not last:
        return None

    current_score = current_summary.get("average_score", 0)
    last_score = last.get("score", 0)
    score_diff = current_score - last_score

    current_violations = current_summary.get("total_violations", 0)
    last_violations = last.get("total_violations", 0)
    violations_diff = current_violations - last_violations

    return {
        "last_scan": {
            "grade": last["grade"],
            "score": last_score,
            "date": last["created_at"],
            "total_violations": last_violations,
        },
        "score_diff": score_diff,
        "violations_diff": violations_diff,
        "trend": "improving" if score_diff > 0 else "declining" if score_diff < 0 else "stable",
    }
