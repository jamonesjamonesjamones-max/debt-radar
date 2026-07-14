"""
Scanner: Descubrimiento de archivos con poda previa, .gitignore y detección de minificados.
Seguridad: path traversal prevention, symlink protection, sensitive file filtering.
"""

import os
from typing import Optional

import pathspec

# === Directorios que SIEMPRE se ignoran (sin importar .gitignore) ===
ALWAYS_IGNORE: set[str] = {
    "node_modules",
    "__pycache__",
    ".git",
    ".svn",
    ".hg",
    ".venv",
    "venv",
    "env",
    ".env",
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    ".ruff_cache",
    ".cache",
    "dist",
    "build",
    "out",
    "target",
    ".next",
    ".nuxt",
    ".output",
    "coverage",
    ".nyc_output",
    "vendor",
    "Pods",
    ".gradle",
    ".idea",
    ".vscode",
    ".DS_Store",
    "Thumbs.db",
    "egg-info",
    ".eggs",
}

# === Extensiones soportadas ===
SUPPORTED_EXTENSIONS: set[str] = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
}

# === Extensiones sensibles (nunca escanear) ===
SENSITIVE_EXTENSIONS: set[str] = {
    ".pem", ".key", ".p12", ".pfx", ".crt", ".cer",
    ".env", ".secret",
    ".sqlite", ".db",
}

# === Nombres sensibles (nunca escanear) ===
SENSITIVE_FILENAMES: set[str] = {
    ".env", ".env.local", ".env.production", ".env.staging",
    "secrets.json", "credentials.json", "service-account.json",
    "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519",
    ".htpasswd", ".netrc",
}

# === Límites ===
MAX_FILES = 5000
MAX_FILE_SIZE_BYTES = 1_000_000  # 1MB
MAX_DEPTH = 20  # Maximum directory depth


def is_minified_file(filepath: str) -> bool:
    """
    Detecta archivos minificados mediante heurísticas de nombre y longitud de línea.
    Lee solo los primeros 1KB para eficiencia.
    """
    # 1. Patrón de nombre
    basename = os.path.basename(filepath).lower()
    if ".min." in basename or ".bundle." in basename:
        return True

    # 2. Heurística de longitud de línea promedio (lee solo primeros 1KB)
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            chunk = f.read(1024)  # Solo primeros 1KB
            if not chunk:
                return False

            lines = chunk.split("\n")
            if len(lines) == 0:
                return False

            avg_line_length = sum(len(line) for line in lines) / len(lines)
            # Si promedio > 500 caracteres y < 10 líneas en los primeros 1KB
            if avg_line_length > 500 and len(lines) < 10:
                return True
    except (OSError, UnicodeDecodeError):
        pass

    return False


def _is_sensitive_file(filepath: str) -> bool:
    """Verifica si un archivo es sensible y no debe ser escaneado."""
    basename = os.path.basename(filepath).lower()

    # Por nombre
    if basename in SENSITIVE_FILENAMES:
        return True

    # Por extensión
    _, ext = os.path.splitext(basename)
    if ext in SENSITIVE_EXTENSIONS:
        return True

    return False


def _load_gitignore(root_path: str) -> Optional[pathspec.PathSpec]:
    """Carga .gitignore de la raíz del proyecto."""
    gitignore_path = os.path.join(root_path, ".gitignore")
    if not os.path.isfile(gitignore_path):
        return None

    try:
        with open(gitignore_path, "r", encoding="utf-8", errors="ignore") as f:
            patterns = f.read()
        return pathspec.GitIgnoreSpec.from_lines(patterns.splitlines())
    except (OSError, ValueError):
        return None


def discover_files(root_path: str) -> tuple[list[str], list[dict]]:
    """
    Descubre archivos analizables en root_path con poda previa de directorios.
    Seguridad: path normalizado, symlink protection, depth limit, sensitive file filter.
    """
    # Normalizar path para prevenir traversal
    root_path = os.path.abspath(root_path)

    spec = _load_gitignore(root_path)

    file_paths: list[str] = []
    skipped: list[dict] = []
    file_count = 0

    for dirpath, dirnames, filenames in os.walk(root_path, followlinks=False):
        # Calcular profundidad actual
        depth = dirpath[len(root_path):].count(os.sep)
        if depth >= MAX_DEPTH:
            dirnames.clear()  # No descender más
            continue

        # === PODA IN-PLACE ===
        dirnames[:] = [
            d
            for d in dirnames
            if d not in ALWAYS_IGNORE
            and not d.startswith(".")
            and (spec is None or not spec.match_file(os.path.join(dirpath, d)))
        ]

        for filename in filenames:
            # Límite de archivos
            if file_count >= MAX_FILES:
                skipped.append({
                    "path": dirpath,
                    "reason": f"File limit of {MAX_FILES} reached",
                })
                return file_paths, skipped

            filepath = os.path.join(dirpath, filename)

            # Solo extensiones soportadas
            _, ext = os.path.splitext(filename)
            if ext.lower() not in SUPPORTED_EXTENSIONS:
                continue

            # Ignorar archivos ocultos
            if filename.startswith("."):
                continue

            # Filtrar archivos sensibles
            if _is_sensitive_file(filepath):
                skipped.append({"path": filepath, "reason": "Archivo sensible (credenciales/keys)"})
                continue

            # Verificar .gitignore
            if spec and spec.match_file(filepath):
                skipped.append({"path": filepath, "reason": "Ignorado por .gitignore"})
                continue

            # Detectar minificados
            if is_minified_file(filepath):
                skipped.append({"path": filepath, "reason": "Archivo minificado detectado"})
                continue

            # Verificar que es un archivo real (no symlink roto)
            if not os.path.isfile(filepath):
                skipped.append({"path": filepath, "reason": "Not a valid file"})
                continue

            # Skip archivos muy grandes
            try:
                file_size = os.path.getsize(filepath)
                if file_size > MAX_FILE_SIZE_BYTES:
                    skipped.append({"path": filepath, "reason": f"Archivo demasiado grande ({file_size // 1024}KB)"})
                    continue
            except OSError:
                skipped.append({"path": filepath, "reason": "Could not get file size"})
                continue

            file_paths.append(filepath)
            file_count += 1

    return file_paths, skipped
