# Bugfix Design Document

## Root Cause Analysis

Los tres defectos comparten la misma causa raíz: el código asume rutas de estilo Unix (separador `/`, prefijos como `/etc`) tanto para detectar directorios sensibles como para acortar rutas en la salida del CLI. En Windows las rutas usan `\` como separador y prefijos de unidad (`C:\`), por lo que:

- La comparación `expanded.startswith(sensitive + "/")` en `_validate_path` nunca coincide con una ruta Windows.
- El CLI (`_run_scan`) nunca llamó a esa lógica de bloqueo, así que el problema de Windows ni siquiera se manifiesta ahí — el CLI simplemente no tiene ninguna protección, en ninguna plataforma.
- El acortado de rutas en `_show_text_report` busca literalmente el carácter `"/"`, que no aparece en rutas Windows.

La corrección correcta no es "parchar" las comparaciones existentes, sino centralizar la lógica de detección de rutas sensibles en un solo lugar multiplataforma, y reutilizarla tanto en la API como en el CLI. Esto también resuelve la inconsistencia del BUG #2 de raíz (ya no hay dos implementaciones que puedan desincronizarse).

## Solution Strategy

### 1. Nuevo módulo: `backend/utils/path_security.py`

Centraliza la detección de rutas sensibles del sistema, multiplataforma.

```python
"""
Path Security — Detección multiplataforma de directorios sensibles del sistema.
Usado por api/routes.py y cli.py para bloquear escaneos sobre rutas del SO.
"""

import os
from pathlib import Path

# Directorios sensibles Unix/Linux/Mac (existentes, sin cambios de comportamiento)
_SENSITIVE_UNIX = [
    "/etc", "/proc", "/sys", "/dev", "/boot", "/root",
    "/var/log", "/var/run", "/tmp/.private",
    "/etc/shadow", "/etc/passwd", "/etc/ssh",
]

# Directorios sensibles Windows
_SENSITIVE_WINDOWS = [
    r"C:\Windows",
    r"C:\Program Files",
    r"C:\Program Files (x86)",
    r"C:\ProgramData",
]


def _sensitive_roots() -> list[Path]:
    """Construye la lista de Path sensibles, incluyendo WINDIR real si está disponible."""
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
    un directorio sensible del sistema. Multiplataforma: compara por contención
    real de rutas (Path), no por concatenación de strings.
    """
    try:
        candidate = Path(os.path.normcase(expanded_path)).resolve(strict=False)
    except (OSError, ValueError):
        candidate = Path(os.path.normcase(expanded_path))

    for root in _SENSITIVE_ROOTS:
        try:
            root_norm = Path(os.path.normcase(str(root)))
        except (OSError, ValueError):
            continue

        if candidate == root_norm or root_norm in candidate.parents:
            return True

    return False
```

Notas de diseño:
- `os.path.normcase` normaliza mayúsculas/minúsculas y separadores en Windows (no hace nada en Unix), así `c:\windows\system32` y `C:\Windows\System32` se detectan igual.
- Se usa `root_norm in candidate.parents` (o igualdad exacta) en lugar de `startswith`, que es la forma correcta de comprobar contención de rutas con `pathlib` y evita falsos positivos como `/etc-backup` coincidiendo con `/etc`.
- Se añaden `WINDIR`/`SystemRoot`/`SystemDrive` como fuente adicional para cubrir instalaciones en unidades distintas a `C:`, sin perder las rutas hardcodeadas como fallback.
- La lista Unix se mantiene idéntica a la actual — comportamiento en Unix no cambia (requisito 3.1).

### 2. `backend/api/routes.py::_validate_path`

Reemplazar el bloque de bucle sobre `SENSITIVE_PATHS` por una llamada a la función compartida:

```python
from utils.path_security import is_sensitive_system_path

def _validate_path(path: str) -> str:
    if not path or not path.strip():
        raise HTTPException(status_code=400, detail="Path cannot be empty")

    expanded = os.path.expanduser(path.strip())
    expanded = os.path.abspath(expanded)

    if is_sensitive_system_path(expanded):
        raise HTTPException(
            status_code=403,
            detail="Access denied to system directory",
        )

    if not os.path.exists(expanded):
        raise HTTPException(status_code=404, detail="Path not found")

    if not os.path.isdir(expanded):
        raise HTTPException(status_code=400, detail="Path is not a directory")

    if not os.access(expanded, os.R_OK):
        raise HTTPException(status_code=403, detail="Read permission denied")

    return expanded
```

Se elimina la constante `SENSITIVE_PATHS` de `routes.py` (queda solo en `path_security.py`). El orden de validaciones no cambia, así que los códigos de estado para los demás casos (400 vacío, 404 no existe, 400 no directorio, 403 sin permiso) se preservan exactamente.

### 3. `backend/cli.py::_run_scan`

Añadir el mismo chequeo antes de `discover_files`:

```python
from utils.path_security import is_sensitive_system_path

def _run_scan(path: str, workers: int, max_files: int, quiet: bool = False) -> dict:
    c = Console(stderr=True) if quiet else console
    expanded = os.path.expanduser(path)
    expanded = os.path.abspath(expanded)

    if not os.path.exists(expanded):
        c.print(f"[red]❌ Error: Path no encontrado: {expanded}[/red]")
        raise typer.Exit(1)

    if not os.path.isdir(expanded):
        c.print(f"[red]❌ Error: No es un directorio: {expanded}[/red]")
        raise typer.Exit(1)

    if is_sensitive_system_path(expanded):
        c.print(f"[red]❌ Error: Acceso denegado a directorio del sistema: {expanded}[/red]")
        raise typer.Exit(1)

    ...
```

Nota de import: `cli.py` ya hace `sys.path.insert(0, str(Path(__file__).parent))` al inicio, por lo que `from utils.path_security import is_sensitive_system_path` funciona igual que los imports existentes de `analyzer.scanner` y `analyzer.orchestrator`.

### 4. `backend/cli.py::_show_text_report` — acortado de rutas multiplataforma

Añadir una función auxiliar y reemplazar los dos bloques que usan `"/"`:

```python
def _shorten_path(path: str, keep: int = 3) -> str:
    """Acorta un path a sus últimos `keep` componentes, multiplataforma."""
    parts = [p for p in Path(path).parts if p not in (os.sep, "/", "\\")]
    if len(parts) > keep:
        return str(Path(*parts[-keep:]))
    return path
```

Reemplazar en Top Offenders:
```python
short_path = _shorten_path(t["path"])
```

Reemplazar en All files:
```python
short = _shorten_path(f.get("path", ""))
```

Se elimina la lógica `if "/" in short_path: parts = short_path.split("/"); ...` en ambos lugares. `Path(path).parts` funciona correctamente tanto para rutas Windows (`C:\Users\...`) como Unix (`/home/...`), incluyendo el manejo del prefijo de unidad como un componente propio, que luego se filtra si coincide con un separador puro.

### Resumen de archivos modificados

| Archivo | Cambio |
|---|---|
| `backend/utils/path_security.py` | **Nuevo.** `is_sensitive_system_path()` multiplataforma. |
| `backend/api/routes.py` | `_validate_path` usa `is_sensitive_system_path`; se elimina `SENSITIVE_PATHS`. |
| `backend/cli.py` | `_run_scan` añade chequeo de path sensible; `_show_text_report` usa `_shorten_path()` multiplataforma en los 2 sitios afectados. |

## Testing Strategy

1. **Unit tests — `backend/utils/path_security.py`** (nuevo archivo `backend/tests/test_path_security.py` si no existe carpeta de tests, crearla):
   - `is_sensitive_system_path("/etc")` → `True` (Unix, comportamiento preservado).
   - `is_sensitive_system_path("/etc/passwd")` → `True`.
   - `is_sensitive_system_path("/home/user/project")` → `False`.
   - `is_sensitive_system_path(r"C:\Windows")` → `True`.
   - `is_sensitive_system_path(r"C:\Windows\System32")` → `True`.
   - `is_sensitive_system_path(r"C:\Users\javie\project")` → `False`.
   - `is_sensitive_system_path(r"c:\windows\system32")` (minúsculas) → `True` (normcase).

2. **Integración API** (manual vía `Invoke-WebRequest`/`curl`, como en la revisión previa):
   - `POST /api/scan` con `path: "C:\\Windows\\System32"` → esperar `403`.
   - `POST /api/scan` con `path` a un repo de usuario normal → esperar `200` (regresión, debe seguir funcionando).

3. **Integración CLI**:
   - `python cli.py scan C:\Windows\System32` → exit code `1`, mensaje de error, sin llamar a `discover_files`.
   - `python cli.py scan backend/analyzer` → comportamiento actual sin cambios (exit code según `--fail-below` si aplica).

4. **Acortado de rutas**:
   - `_shorten_path(r"C:\Users\javie\OneDrive\project\backend\analyzer\scanner.py")` → últimos 3 componentes (`project\backend\analyzer\scanner.py` o similar según el valor de `keep`).
   - `_shorten_path("/a/b/c/d/e.py")` → comportamiento igual al actual en Unix (regresión).
   - `_shorten_path("short/path.py")` (≤3 componentes) → sin cambios.

5. **Regresión general**: repetir el escaneo end-to-end ya validado (backend real vía Uvicorn + CLI) sobre el propio repo para confirmar que scoring, SSE, badge, export-html y `--fail-below` siguen funcionando igual que antes del fix.
