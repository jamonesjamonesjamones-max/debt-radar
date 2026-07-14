# Implementation Plan

- [x] 1. Crear módulo `backend/utils/path_security.py` con `is_sensitive_system_path()`
  - Incluir listas `_SENSITIVE_UNIX` (idéntica a la actual `SENSITIVE_PATHS` de `routes.py`) y `_SENSITIVE_WINDOWS`.
  - Añadir detección dinámica vía `WINDIR`/`SystemRoot`/`SystemDrive`.
  - Implementar comparación por contención de `pathlib.Path` normalizado con `os.path.normcase`, no por `startswith` de strings.
  - _Bug: #1, #2 (base compartida)_

- [x] 2. Actualizar `backend/api/routes.py::_validate_path` para usar `is_sensitive_system_path`
  - Reemplazar el bucle sobre `SENSITIVE_PATHS` por la llamada a la función del nuevo módulo.
  - Eliminar la constante `SENSITIVE_PATHS` ya no usada.
  - Preservar el resto de validaciones y códigos de estado (400 vacío, 404, 400 no directorio, 403 sin permiso) sin cambios.
  - _Bug: #1_

- [x] 3. Actualizar `backend/cli.py::_run_scan` para validar paths sensibles
  - Importar `is_sensitive_system_path` desde `utils.path_security`.
  - Añadir chequeo tras la validación de existencia/directorio y antes de `discover_files`, saliendo con `typer.Exit(1)` y mensaje de error si el path es sensible.
  - _Bug: #2_

- [x] 4. Añadir `_shorten_path()` multiplataforma en `backend/cli.py` y usarla en `_show_text_report`
  - Implementar la función auxiliar basada en `Path(path).parts`.
  - Reemplazar los dos bloques que usan `"/" in short_path` / `split("/")` (Top Offenders y All files) por llamadas a `_shorten_path`.
  - _Bug: #3_

- [x] 5. Verificación manual end-to-end
  - Levantar backend (Uvicorn) y probar `POST /api/scan` con `C:\Windows\System32` (esperar 403) y con un path normal (esperar 200, regresión).
  - Ejecutar `python cli.py scan C:\Windows\System32` (esperar exit code 1) y `python cli.py scan backend/analyzer` (comportamiento sin cambios).
  - Confirmar visualmente que las tablas del CLI muestran rutas acortadas en Windows.

## Resultados de verificación

**Unit tests `is_sensitive_system_path`:** 9/9 casos OK (Unix sensibles, Windows sensibles, normales, mayúsculas/minúsculas).

**API (`POST /api/scan`):**
- `C:\Windows\System32` → 403 (antes: 200, bug corregido)
- `C:\Program Files` → 403
- Path normal de usuario → 200 (regresión OK)
- Path inexistente → 404 (regresión OK)
- Path vacío → 400 (regresión OK)

**CLI:**
- `cli.py scan C:\Windows\System32` → exit code 1, mensaje de error, sin analizar archivos (antes: procedía sin protección)
- `cli.py scan analyzer --workers 2` → funciona igual que antes, tablas ahora muestran `backend\analyzer\orchestrator.py` en vez de la ruta absoluta completa

Todos los bugs (#1, #2, #3) corregidos y verificados sin regresiones.
