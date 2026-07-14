"""
Path Security — Detección multiplataforma de directorios sensibles del sistema.
Usado por api/routes.py y cli.py para bloquear escaneos sobre rutas del SO.
"""

import os
from pathlib import Path

# Directorios sensibles Unix/Linux/Mac (idénticos a los ya existentes en routes.py)
_SENSITIVE_UNIX = [
    "/etc", "/proc", "/sys", "/dev", "/boot", "/root",
    "/var/log", "/var/run", "/tmp/.private",
    "/etc/shadow", "/etc/passwd", "/etc/ssh",
]

# Directorios sensibles Windows (rutas comunes hardcodeadas)
_SENSITIVE_WINDOWS = [
    r"C:\Windows",
    r"C:\Program Files",
    r"C:\Program Files (x86)",
    r"C:\ProgramData",
]


def _sensitive_roots() -> list[Path]:
    """Construye la lista de Path sensibles, incluyendo WINDIR/SystemDrive reales si están disponibles."""
    roots = [Path(p) for p in _SENSITIVE_UNIX] + [Path(p) for p in _SENSITIVE_WINDOWS]

    windir = os.environ.get("WINDIR") or os.environ.get("SystemRoot")
    if windir:
        roots.append(Path(windir))

    systemdrive = os.environ.get("SystemDrive")  # ej. "C:"
    if systemdrive:
        roots.append(Path(f"{systemdrive}\\Windows"))
        roots.append(Path(f"{systemdrive}\\Program Files"))
        roots.append(Path(f"{systemdrive}\\Program Files (x86)"))
        roots.append(Path(f"{systemdrive}\\ProgramData"))

    return roots


_SENSITIVE_ROOTS = _sensitive_roots()


def is_sensitive_system_path(expanded_path: str) -> bool:
    """
    Determina si expanded_path (ya absoluto/expandido) apunta a, o está dentro de,
    un directorio sensible del sistema.

    Multiplataforma: compara por contención real de rutas usando pathlib + normcase,
    en vez de concatenación de strings con "/", que solo funciona en Unix.
    """
    if not expanded_path:
        return False

    try:
        candidate = Path(os.path.normcase(expanded_path))
    except (OSError, ValueError):
        return False

    for root in _SENSITIVE_ROOTS:
        try:
            root_norm = Path(os.path.normcase(str(root)))
        except (OSError, ValueError):
            continue

        if candidate == root_norm or root_norm in candidate.parents:
            return True

    return False
