"""
Git Blame Analyzer — Cruza violaciones con autores de código.
"""

import os
from typing import Optional

from utils.git_utils import is_git_repo, run_git_blame


def analyze_blame(repo_path: str, files_with_violations: list[dict]) -> dict:
    """
    Cruza las violaciones de los archivos con git blame para atribuir deuda a autores.

    Args:
        repo_path: ruta del repositorio
        files_with_violations: lista de dicts con 'path' y 'violations'

    Returns:
        dict con authors (autor → stats) y summary
    """
    if not is_git_repo(repo_path):
        return {"error": "No es un repositorio Git", "authors": {}, "summary": {}}

    # Mapa: autor → {violations, files, by_type}
    author_stats: dict[str, dict] = {}

    for file_data in files_with_violations:
        filepath = file_data.get("path", "")
        violations = file_data.get("violations", [])

        if not violations:
            continue

        # Hacer blame del archivo
        line_authors = run_git_blame(repo_path, filepath)

        if not line_authors:
            continue

        # Cruzar violaciones con autores
        for violation in violations:
            line = violation.get("line", 0)
            author = line_authors.get(line, "Unknown")

            if author not in author_stats:
                author_stats[author] = {
                    "violations": 0,
                    "files": set(),
                    "by_type": {"max_nesting": 0, "magic_number": 0, "todo": 0},
                }

            author_stats[author]["violations"] += 1
            author_stats[author]["files"].add(filepath)
            vtype = violation.get("type", "unknown")
            if vtype in author_stats[author]["by_type"]:
                author_stats[author]["by_type"][vtype] += 1

    # Convertir sets a counts para serialización
    result_authors = {}
    for author, stats in author_stats.items():
        result_authors[author] = {
            "violations": stats["violations"],
            "files_count": len(stats["files"]),
            "by_type": stats["by_type"],
        }

    # Ordenar por número de violaciones (descendente)
    sorted_authors = dict(
        sorted(result_authors.items(), key=lambda x: x[1]["violations"], reverse=True)
    )

    total_violations = sum(a["violations"] for a in sorted_authors.values())

    return {
        "repo_path": repo_path,
        "authors": sorted_authors,
        "summary": {
            "total_authors": len(sorted_authors),
            "total_violations_attributed": total_violations,
        },
    }
