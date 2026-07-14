"""
Git History Analyzer — Analiza la evolución del score a lo largo de commits.
"""

import os
import time
from typing import Optional

from utils.git_utils import GitSafeContext, get_commit_log, is_git_repo
from analyzer.scanner import discover_files
from analyzer.orchestrator import safe_process_file
from analyzer.metrics import aggregate_results


def analyze_commit_score(repo_path: str, commit_hash: str, max_files: int = 500) -> Optional[dict]:
    """
    Analiza el score de un commit específico.
    Retorna dict con score, grade, total_files, total_lines o None si falla.
    """
    ctx = GitSafeContext(repo_path)
    with ctx:
        if not ctx.checkout(commit_hash):
            return None

        # Descubrir y analizar archivos (limitado)
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
        summary = agg["summary"]

        return {
            "score": summary["average_score"],
            "grade": summary["grade"],
            "total_files": summary["total_files"],
            "total_lines": summary["total_lines"],
            "violations": summary["total_violations"],
        }


def analyze_last_n_commits(repo_path: str, n: int = 5, max_files: int = 500) -> dict:
    """
    Analiza los últimos N commits y retorna la evolución del score.
    Retorna dict con commits (lista) y current (score actual).
    """
    if not is_git_repo(repo_path):
        return {"error": "No es un repositorio Git", "commits": [], "current": None}

    commits = get_commit_log(repo_path, n)
    if not commits:
        return {"error": "No se encontraron commits", "commits": [], "current": None}

    # Analizar cada commit
    history = []
    for commit in commits:
        score_data = analyze_commit_score(repo_path, commit["hash"], max_files)
        if score_data:
            history.append({
                "hash": commit["hash"][:8],
                "date": commit["date"],
                "author": commit["author"],
                "message": commit["message"][:80],
                **score_data,
            })
        else:
            history.append({
                "hash": commit["hash"][:8],
                "date": commit["date"],
                "author": commit["author"],
                "message": commit["message"][:80],
                "score": None,
                "grade": "?",
                "error": "No se pudo analizar",
            })

    return {
        "repo_path": repo_path,
        "commits_analyzed": len(history),
        "commits": history,
    }
