"""
Git Safe Executor — Protocolo de seguridad para operaciones Git.
Toda operación Git DEBE preservar el estado del working tree del usuario.
"""

import subprocess
import os
from typing import Optional


def is_git_repo(path: str) -> bool:
    """Verifica si el path es un repositorio Git."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            cwd=path,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return result.returncode == 0
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def get_current_branch(path: str) -> Optional[str]:
    """Obtiene la rama actual del repositorio."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=path,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return None


def has_uncommitted_changes(path: str) -> bool:
    """Verifica si hay cambios sin commitear."""
    try:
        result = subprocess.run(
            ["git", "status", "--porcelain"],
            cwd=path,
            capture_output=True,
            text=True,
            timeout=10,
        )
        return bool(result.stdout.strip())
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return False


def get_current_commit_hash(path: str) -> Optional[str]:
    """Obtiene el hash del commit actual."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=path,
            capture_output=True,
            text=True,
            timeout=10,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return None


class GitSafeContext:
    """
    Context manager para operaciones Git seguras.
    Guarda el estado actual y lo restaura en el bloque finally.

    Uso:
        with GitSafeContext(repo_path) as ctx:
            ctx.checkout(commit_hash)
            # ... hacer análisis ...
    """

    def __init__(self, repo_path: str):
        self.repo_path = repo_path
        self.original_branch: Optional[str] = None
        self.original_commit: Optional[str] = None
        self.did_stash: bool = False
        self._entered: bool = False

    def __enter__(self):
        self._entered = True
        self.original_branch = get_current_branch(self.repo_path)
        self.original_commit = get_current_commit_hash(self.repo_path)

        # Si hay cambios sin commitear, hacer stash
        if has_uncommitted_changes(self.repo_path):
            result = subprocess.run(
                ["git", "stash", "push", "-u", "-m", "debtradar-auto-stash"],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=30,
            )
            self.did_stash = result.returncode == 0

        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if not self._entered:
            return False

        try:
            # Volver al commit/rama original
            if self.original_commit:
                subprocess.run(
                    ["git", "checkout", self.original_commit],
                    cwd=self.repo_path,
                    capture_output=True,
                    text=True,
                    timeout=30,
                )

            # Si hicimos stash, restaurar
            if self.did_stash:
                subprocess.run(
                    ["git", "stash", "pop"],
                    cwd=self.repo_path,
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
        except Exception:
            pass  # No propagar errores de cleanup

        return False  # No suprimir excepciones

    def checkout(self, commit_hash: str) -> bool:
        """Hace checkout a un commit específico."""
        try:
            result = subprocess.run(
                ["git", "checkout", commit_hash],
                cwd=self.repo_path,
                capture_output=True,
                text=True,
                timeout=30,
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False


def get_commit_log(path: str, n: int = 5) -> list[dict]:
    """
    Obtiene los últimos N commits del repositorio.
    Retorna lista de dicts con: hash, date, message, author
    """
    try:
        result = subprocess.run(
            ["git", "log", f"--pretty=format:%H|%ai|%an|%s", f"-n{n}"],
            cwd=path,
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode != 0:
            return []

        commits = []
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("|", 3)
            if len(parts) >= 4:
                commits.append({
                    "hash": parts[0],
                    "date": parts[1],
                    "author": parts[2],
                    "message": parts[3],
                })
        return commits
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return []


def run_git_blame(path: str, filepath: str) -> dict[int, str]:
    """
    Ejecuta git blame en un archivo y retorna un mapa {line_number: author_name}.
    """
    try:
        result = subprocess.run(
            ["git", "blame", "--line-porcelain", filepath],
            cwd=path,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode != 0 or not result.stdout:
            return {}

        line_authors = {}
        current_line = 0
        current_author = "Unknown"

        for line in result.stdout.split("\n"):
            if line.startswith("author "):
                current_author = line[7:]
            elif line.startswith("\t"):
                current_line += 1
                line_authors[current_line] = current_author

        return line_authors
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return {}
