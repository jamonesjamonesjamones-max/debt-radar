# 📡 DebtRadar — Documento de Contexto Completo

> Este documento describe el funcionamiento total de DebtRadar. Cada archivo, cada función, cada flujo de datos. Si lees esto, entenderás el 100% del sistema.

---

## Tabla de Contenidos

1. [Visión General](#1-visión-general)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Backend — Archivos y Funciones](#3-backend--archivos-y-funciones)
4. [Frontend — Archivos y Componentes](#4-frontend--archivos-y-componentes)
5. [Flujos de Datos](#5-flujos-de-datos)
6. [Sistema de Scoring](#6-sistema-de-scoring)
7. [God Mode Features](#7-god-mode-features)
8. [6 Fixes Críticos](#8-6-fixes-críticos)
9. [Seguridad y Performance](#9-seguridad-y-performance)
10. [Manejo de Edge Cases](#10-manejo-de-edge-cases)
11. [Configuración y Deployment](#11-configuración-y-deployment)
12. [Estructura de Archivos Final](#12-estructura-de-archivos-final)

---

## 1. Visión General

**DebtRadar** es una aplicación híbrida local (Python Backend + React Frontend) que analiza repositorios de código fuente para cuantificar deuda técnica, detectar sobre-ingeniería y alertar sobre patrones de complejidad accidental.

### Qué Detecta
1. Archivos monolíticos (>800 líneas)
2. Complejidad ciclomática extrema (>7 niveles de anidamiento)
3. Sobre-ingeniería (funciones con >20 bifurcaciones)
4. Magic numbers (literales sin contexto)
5. TODOs acumulados
6. Evolución histórica en commits
7. Responsabilidad por autor (git blame)

### Qué NO Detecta
1. Si el código fue escrito por IA o humano (detectamos síntomas, no origen)
2. Bugs lógicos o errores de runtime (analizamos estructura, no semántica)
3. Problemas de seguridad (usar herramientas especializadas)

### Stack tecnológico
| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.11+, FastAPI, Uvicorn |
| Análisis AST | Tree-sitter (paquetes precompilados) |
| Concurrencia | ProcessPoolExecutor con timeout |
| Filtros | pathspec para .gitignore |
| CLI | typer + rich |
| Historial | SQLite (~/.debtradar/history.db) |
| IA Local | Ollama (opcional) |
| Frontend | React 18, Vite, TailwindCSS |
| Gráficos | Recharts (Treemap, Radar, Line, Bar) |
| Comunicación | Server-Sent Events (SSE) |

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                          │
│                                                                      │
│  OnboardingModal (4 pasos, primera vez)                              │
│  TopNav (input path + recent paths dropdown + slider workers)        │
│     ↓ POST /api/scan                                                 │
│  useAnalysis hook (maneja SSE + estados + jobId)                     │
│     ↓ EventSource /api/scan/{job_id}/stream                          │
│  Dashboard → SummaryBar (Export + Badge buttons)                     │
│            → HeatMap + RadarChart + HallOfShame + CodeViewer         │
│            → ScanHistory (comparación + gráfico histórico)           │
│            → GitTabs (TimelineChart + BlameChart)                    │
│  LoadingState (progreso + cronómetro)                                │
│  EmptyStates (Idle, NoFiles, ScanTooLarge, Error)                    │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTP + SSE + CORS
┌──────────────────────────▼──────────────────────────────────────────┐
│                     BACKEND (FastAPI + Uvicorn)                       │
│                                                                      │
│  main.py → FastAPI app + CORS + security headers middleware          │
│  api/routes.py → POST /scan (rate limit + path validation)           │
│                → GET /scan/{id}/stream (SSE + disconnect cleanup)     │
│                → GET /badge/{id} (SVG dinámico)                      │
│                → POST /export-html (reporte autocontenido)           │
│                → GET /scan/{id}/history (git commits)                │
│                → GET /scan/{id}/blame (deuda por autor)              │
│                → GET /ollama-status + POST /refactor-suggestion      │
│                → GET /scan/history (SQLite histórico)                │
│  api/schemas.py → Modelos Pydantic                                   │
│     ↓                                                                │
│  analyzer/scanner.py → discover_files() con poda + sensitive filter  │
│  analyzer/orchestrator.py → ProcessPoolExecutor + safe_process_file  │
│  analyzer/metrics.py → scoring + agregación + comparison             │
│  analyzer/git_history.py → análisis de commits                       │
│  analyzer/git_blame.py → cruza violaciones con autores               │
│     ↓                                                                │
│  parsers/parser_pool.py → Tree-sitter parsers (PY/JS/TS/TSX)        │
│  parsers/ast_analyzer.py → análisis AST iterativo + ubicaciones      │
│  parsers/regex_patterns.py → patrones TODO/FIXME (case-sensitive)    │
│     ↓                                                                │
│  utils/badges.py → generador SVG de badges                           │
│  utils/report_generator.py → reporte HTML con Jinja2 + Chart.js     │
│  utils/git_utils.py → GitSafeContext + blame + log                   │
│  utils/llm_client.py → cliente Ollama                                │
│  utils/history_db.py → SQLite para tracking histórico                │
│  utils/path_security.py → detección multiplataforma de paths sensibles│
│  cli.py → CLI con typer + rich (--fail-below, --output json)         │
│  calibrate_scoring.py → calibración con repos de referencia          │
└─────────────────────────────────────────────────────────────────────┘
```

### Orden de dependencias
```
main.py
  └→ api/routes.py
       ├→ api/schemas.py
       ├→ analyzer/scanner.py
       ├→ analyzer/orchestrator.py
       │    ├→ parsers/ast_analyzer.py
       │    │    ├→ parsers/parser_pool.py
       │    │    └→ parsers/regex_patterns.py
       │    └→ analyzer/metrics.py
       ├→ analyzer/metrics.py (agregación)
       ├→ analyzer/git_history.py
       │    └→ utils/git_utils.py
       ├→ analyzer/git_blame.py
       │    └→ utils/git_utils.py
       ├→ utils/badges.py
       ├→ utils/report_generator.py
       ├→ utils/llm_client.py
       ├→ utils/history_db.py
       └→ utils/path_security.py (también usado por cli.py)
```

---

## 3. Backend — Archivos y Funciones

### 3.1 `backend/main.py` — Entry Point

| Elemento | Descripción |
|----------|-------------|
| `app` | FastAPI v1.0.0 |
| CORS | Solo `http://127.0.0.1:5173` y `http://localhost:5173` |
| `allow_methods` | `["GET", "POST", "OPTIONS"]` |
| `allow_headers` | `["Content-Type"]` |
| `security_headers` middleware | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` |
| `healthcheck()` | `GET /` → `{"status":"ok","service":"DebtRadar","version":"1.0.0"}` |

---

### 3.2 `backend/api/schemas.py` — Modelos Pydantic

| Modelo | Campos clave |
|--------|-------------|
| `ScanRequest` | `path: str`, `workers: int` (1-8) |
| `Violation` | `type`, `line`, `column?`, `end_line?`, `severity`, `context` |
| `Deductions` | `file_size`, `complexity`, `todos`, `magic_numbers`, `function_complexity` (todos `int`) |
| `FileResult` | `path`, `lines`, `score`, `language`, `deductions`, `violations[]` |
| `Summary` | 12 campos: `total_files`, `total_lines`, `average_score`, `grade`, `grade_label`, `scan_time_seconds`, `workers_used`, `files_skipped`, `total_violations`, `violations_by_type`, `grade_distribution`, `top_offenders` |
| `ScanResponse` | `summary`, `files[]`, `skipped_files[]` |
| `ScanJobCreated` | `job_id`, `status` |

---

### 3.3 `backend/api/routes.py` — Endpoints

#### Constantes
| Variable | Valor | Descripción |
|----------|-------|-------------|
| `active_jobs` | dict | Jobs en memoria |
| `MAX_ACTIVE_JOBS` | 100 | Límite memory leak |
| `MAX_CONCURRENT_SCANS` | 5 | Rate limiting |

> La lista de directorios sensibles ya NO vive en `routes.py`. Se movió a `utils/path_security.py::is_sensitive_system_path()` (ver 3.13-bis) para que la misma protección sea multiplataforma y la comparta también el CLI.

#### Endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/scan` | POST | Crea job de escaneo (rate limit, path validation, discovery) |
| `/api/scan/{job_id}/stream` | GET | SSE progreso cada 0.5s (disconnect detection, cleanup) |
| `/api/badge/{job_id}` | GET | Badge SVG dinámico (Cache-Control: no-cache) |
| `/api/export-html` | POST | Reporte HTML autocontenido (descarga) |
| `/api/scan/{job_id}/history` | GET | Historial de commits Git |
| `/api/scan/{job_id}/blame` | GET | Deuda por autor (git blame) |
| `/api/ollama-status` | GET | Estado de Ollama |
| `/api/refactor-suggestion` | POST | Sugerencia IA via Ollama |
| `/api/scan/history` | GET | Historial SQLite de escaneos |

#### Funciones clave

##### `_cleanup_old_jobs()`
Elimina jobs completados/error cuando `active_jobs` supera 100. Mantiene últimos 50.

##### `_count_running_scans() -> int`
Cuenta jobs con `status == "running"` para rate limiting.

##### `_validate_path(path) -> str`
Normaliza con `os.path.abspath(os.path.expanduser())`. Bloquea directorios sensibles llamando a `utils.path_security.is_sensitive_system_path()` (multiplataforma). Errores: 400 (vacío/no-dir), 403 (sensible/sin permisos), 404 (no existe).

##### `create_scan(request) -> ScanJobCreated`
Rate limiting → validate → cleanup → discover_files → validate count → create job → `asyncio.create_task(_run_real_scan)`.

##### `scan_stream(job_id, request) -> StreamingResponse`
SSE cada 0.5s. Detecta `request.is_disconnected()` → marca `cancelled`. Cleanup en `finally` después de 5s.

##### `_run_real_scan(job_id, file_paths, workers)`
Ejecuta `run_scan_job` en `run_in_executor`. Después: `aggregate_results` → `save_scan` (SQLite) → `compare_with_last` → agrega `comparison` al resultado.

---

### 3.4 `backend/analyzer/scanner.py` — Descubrimiento

#### Constantes
| Constante | Valor |
|-----------|-------|
| `ALWAYS_IGNORE` | 32 directorios (node_modules, __pycache__, .git, dist, build, venv, etc.) |
| `SUPPORTED_EXTENSIONS` | {.py, .js, .jsx, .ts, .tsx} |
| `SENSITIVE_EXTENSIONS` | {.pem, .key, .p12, .pfx, .crt, .cer, .env, .secret, .sqlite, .db} |
| `SENSITIVE_FILENAMES` | {.env, .env.local, secrets.json, credentials.json, id_rsa, id_dsa, .htpasswd, .netrc} |
| `MAX_FILES` | 5000 |
| `MAX_FILE_SIZE_BYTES` | 1,000,000 (1MB) |
| `MAX_DEPTH` | 20 |

#### Funciones

##### `is_minified_file(filepath) -> bool`
Detecta por nombre (`.min.`, `.bundle.`) o contenido (lee primeros 1KB, promedio >500 chars y <10 líneas).

##### `_is_sensitive_file(filepath) -> bool`
Verifica nombre en `SENSITIVE_FILENAMES` o extensión en `SENSITIVE_EXTENSIONS`.

##### `_load_gitignore(root_path) -> Optional[PathSpec]`
Carga `.gitignore` con `pathspec.GitIgnoreSpec.from_lines()`.

##### `discover_files(root_path) -> tuple[list[str], list[dict]]`
Normaliza path con `os.path.abspath`. Itera con `os.walk(followlinks=False)`. Poda in-place de `dirnames`. Filtra: ALWAYS_IGNORE, ocultos, extensiones, sensibles, .gitignore, minificados, tamaño, profundidad.

---

### 3.5 `backend/analyzer/orchestrator.py` — Análisis Paralelo

##### `_worker_init()`
Initializer para ProcessPoolExecutor. Importa parsers una vez por worker.

##### `safe_process_file(filepath) -> dict`
Análisis AST + scoring. Si `analyze_file` retorna None: fallback a contar líneas. Captura `PermissionError`, `FileNotFoundError`, `Exception`. Retorna `{path, lines, score, language, deductions, violations}` o `{skipped: True, reason}`.

##### `run_scan_job(job_id, file_paths, worker_count, active_jobs, timeout_per_file=30)`
Secuencial (1 worker) o paralelo (ProcessPoolExecutor). Actualiza progreso en `active_jobs`. Soporta cancelación (`status == "cancelled"`). Maneja `TimeoutError` y `CancelledError`.

---

### 3.6 `backend/parsers/parser_pool.py` — Parsers Tree-sitter

| Variable | API | Extensiones |
|----------|-----|-------------|
| `PYTHON_LANGUAGE` | `tspython.language()` | .py |
| `JS_LANGUAGE` | `tsjavascript.language()` | .js, .jsx |
| `TS_LANGUAGE` | `tstypescript.language_typescript()` | .ts |
| `TSX_LANGUAGE` | `tstypescript.language_tsx()` | .tsx |

---

### 3.7 `backend/parsers/ast_analyzer.py` — Análisis AST

#### Constantes de nodos
- `NESTING_NODES`: nodos que incrementan anidamiento lógico (if/for/while/try/function/class)
- `BRANCH_NODES`: nodos que cuentan como ramas para complejidad ciclomática
- `FUNCTION_NODES`: nodos de definición de función
- `BENIGN_NUMBERS`: {-1, 0, 1, 2, 10, 100, 1000}
- `BENIGN_CONTEXTS`: {subscript, range, array, list, tuple, argument_list, parameters, keyword_argument, slice, import_from_statement}

#### `analyze_file(filepath) -> dict | None`
1. Detecta extensión → parser
2. Lee archivo (límite 1MB)
3. Parsea AST con `parser.parse(content.encode("utf-8"))`
4. Recorrido iterativo con pila: `(node, raw_depth, logical_depth, parent)`
5. Solo incrementa `logical_depth` en nodos de nesting
6. Detecta magic numbers (whitelist + contextos)
7. Trackea complejidad por función
8. Detecta TODOs con regex case-sensitive línea por línea
9. Retorna `{lines, max_nesting, max_function_branches, todos, magic_numbers_suspicious, violations}`

---

### 3.8 `backend/parsers/regex_patterns.py` — Patrones TODO

| Patrón | Regex | Lenguaje |
|--------|-------|----------|
| `TODO_PATTERN` | `r"#\s*(TODO\|FIXME\|HACK\|XXX\|BUG)\b"` | Python |
| `TODO_PATTERN_JS` | `r"//\s*(TODO\|FIXME\|HACK\|XXX\|BUG)\b"` | JS/TS línea |
| `TODO_PATTERN_JS_BLOCK` | `r"/\*\s*(TODO\|FIXME\|HACK\|XXX\|BUG)\b"` | JS/TS bloque |

Case-sensitive. `\b` word boundary.

---

### 3.9 `backend/analyzer/metrics.py` — Scoring y Agregación

#### `get_grade(score) -> tuple[str, str]`
| Score | Grado | Label |
|-------|-------|-------|
| 90-100 | A | Clean Code |
| 75-89 | B | Minor Debt |
| 60-74 | C | High Debt |
| 40-59 | D | Fragile Code |
| 0-39 | F | Biohazard |

#### `calculate_file_score(file_metrics) -> dict`
Base 100. Deducciones:
- Archivos Dios: -40 (>1000), -20 (>500) — excluyente
- Nesting: -30 (>6), -15 (>4) — excluyente
- TODOs: `max((todos/lines)*100 * -2, -20)` — normalizado con techo
- Magic Numbers: `max((magic/lines)*100 * -3, -25)` — normalizado con techo
- Function complexity: -25 (>15 branches), -10 (>10) — excluyente
- Piso: `max(0, score)`

#### `aggregate_results(files, skipped_files, scan_time, workers_used) -> dict`
Score promedio ponderado por líneas. Genera summary completo con 12 campos.

---

### 3.10 `backend/cli.py` — CLI

Uso: `python3 cli.py scan <path> [--workers N] [--output FORMAT] [--fail-below GRADE] [--max-files N]`

| Comando | Descripción |
|---------|-------------|
| `scan` | Escanea repositorio, muestra reporte en terminal |
| `version` | Muestra versión |

Opciones:
- `--workers/-w`: 1-8 workers paralelos
- `--output/-o`: `text` (tablas rich) o `json`
- `--fail-below`: Falla con exit code 1 si grade es menor (A<B<C<D<F)
- `--max-files`: Límite de archivos

Reporte text: Panel con grado, tabla de métricas, violaciones por tipo, distribución de grados, top offenders, tabla completa de archivos.

##### `_run_scan(path, workers, max_files, quiet) -> dict`
Valida existencia y tipo de directorio, y ahora también bloquea directorios sensibles del sistema llamando a `utils.path_security.is_sensitive_system_path()` (misma protección que la API, `typer.Exit(1)` si es sensible) antes de llamar a `discover_files`.

##### `_shorten_path(path, keep=3) -> str`
Acorta una ruta a sus últimos `keep` componentes usando `pathlib.Path(path).parts`, de forma multiplataforma. Reemplaza la lógica anterior basada en `split("/")` que no funcionaba en Windows. Se usa en las tablas "Top Offenders" y "All files" de `_show_text_report`.

---

### 3.11 `backend/utils/badges.py` — Badge SVG

##### `generate_grade_badge(grade, score) -> str`
SVG con label "DebtRadar" y value "{grade} ({score}/100)". Colores por grado.

##### `generate_error_badge() -> str`
SVG con "no data" para jobs inexistentes.

---

### 3.12 `backend/utils/report_generator.py` — Export HTML

##### `generate_html_report(summary, files, skipped_files) -> str`
Renderiza `templates/report.html` con Jinja2. Inyecta: summary, top offenders, radar data, violations by type, grade distribution. Template usa TailwindCSS + Chart.js via CDN.

---

### 3.13 `backend/utils/git_utils.py` — Git Safe Executor

| Función | Descripción |
|---------|-------------|
| `is_git_repo(path)` | Verifica si es repo Git |
| `get_current_branch(path)` | Obtiene rama actual |
| `has_uncommitted_changes(path)` | Verifica cambios sin commitear |
| `get_current_commit_hash(path)` | Hash del commit actual |
| `get_commit_log(path, n)` | Últimos N commits (hash, date, author, message) |
| `run_git_blame(path, filepath)` | Mapa {line_number: author_name} |

##### `GitSafeContext` (context manager)
- `__enter__`: Guarda rama/commit. Si hay cambios sin commitear → `git stash push -u -m "debtradar-auto-stash"`
- `__exit__`: Checkout al commit original + `git stash pop` si se hizo stash. Siempre en `finally`.
- `checkout(commit_hash)`: Hace checkout seguro

---

### 3.14 `backend/analyzer/git_history.py` — Historial de Commits

##### `analyze_commit_score(repo_path, commit_hash, max_files=500) -> dict | None`
Usa `GitSafeContext` para hacer checkout seguro. Descubre y analiza archivos. Retorna `{score, grade, total_files, total_lines, violations}`.

##### `analyze_last_n_commits(repo_path, n=5, max_files=500) -> dict`
Analiza N commits y retorna evolución del score.

---

### 3.15 `backend/analyzer/git_blame.py` — Deuda por Autor

##### `analyze_blame(repo_path, files_with_violations) -> dict`
Para cada archivo con violaciones: ejecuta `run_git_blame`, cruza violaciones con autores. Retorna `{authors: {autor → {violations, files_count, by_type}}, summary}`.

---

### 3.16 `backend/utils/llm_client.py` — Cliente Ollama

##### `check_ollama_status() -> dict`
GET a `http://localhost:11434/api/tags`. Retorna `{available, models}` o `{available: false, error}`.

##### `get_refactor_suggestion(code_snippet, violation_type, violation_context, model) -> dict`
Prompt estricto: "Eres un refactorizador experto. Solo devuelve código". POST a `/api/generate`. Retorna `{suggestion, model}` o `{suggestion: "", error}`.

---

### 3.17 `backend/utils/history_db.py` — SQLite Tracking

DB: `~/.debtradar/history.db`. Tabla `scans` con índices en `path` y `created_at`.

| Función | Descripción |
|---------|-------------|
| `init_db()` | Crea tabla si no existe |
| `save_scan(summary, path)` | Inserta registro |
| `get_scan_history(path, limit=10)` | Lista de scans ordenados por fecha |
| `get_last_scan(path)` | Último scan o None |
| `compare_with_last(current_summary, path)` | Calcula diffs: `score_diff`, `violations_diff`, `trend` (improving/declining/stable) |

---

### 3.18 `backend/utils/path_security.py` — Detección Multiplataforma de Paths Sensibles

Módulo centralizado que reemplaza la antigua constante `SENSITIVE_PATHS` de `routes.py`. Lo usan **tanto la API como el CLI**, evitando que las dos superficies de entrada tengan protecciones distintas.

| Elemento | Descripción |
|----------|-------------|
| `_SENSITIVE_UNIX` | Lista de rutas Unix sensibles (idéntica a la antigua `SENSITIVE_PATHS`): `/etc`, `/proc`, `/sys`, `/dev`, `/boot`, `/root`, `/var/log`, `/var/run`, `/tmp/.private`, `/etc/shadow`, `/etc/passwd`, `/etc/ssh` |
| `_SENSITIVE_WINDOWS` | Rutas Windows hardcodeadas: `C:\Windows`, `C:\Program Files`, `C:\Program Files (x86)`, `C:\ProgramData` |
| `_sensitive_roots()` | Añade dinámicamente `WINDIR`/`SystemRoot`/`SystemDrive` del entorno si están disponibles (soporta instalaciones de Windows en unidades distintas a `C:`) |
| `is_sensitive_system_path(expanded_path) -> bool` | Normaliza el path con `os.path.normcase` + `pathlib.Path` y comprueba **contención real de rutas** (`root_norm in candidate.parents`), no concatenación de strings con `/`. Funciona igual en Windows y Unix/Mac. |

**Por qué existe:** antes, `_validate_path` en `routes.py` comparaba `expanded.startswith(sensitive + "/")`, lo cual nunca coincidía con rutas Windows (`C:\Windows\System32`) porque usan `\` en vez de `/`. Esto dejaba la protección de directorios sensibles completamente inoperante en Windows. Además, el CLI nunca aplicaba ningún chequeo de este tipo. Centralizar la lógica aquí corrige ambos problemas a la vez.

---

### 3.19 `backend/calibrate_scoring.py` — Calibración

Clona 6 repos de referencia (Click, MarkupSafe, Flask, Requests, Django, TensorFlow). Los analiza con DebtRadar. Compara grades obtenidos vs esperados. Reporta precisión y guarda `calibration_results.json`.

---

## 4. Frontend — Archivos y Componentes

### 4.1 Configuración
- `package.json`: React 18, Recharts, Vite
- `vite.config.js`: host `127.0.0.1`, puerto 5173, `strictPort` y proxy de desarrollo `/api` → `http://127.0.0.1:8000`
- `tailwind.config.js`: dark mode, colores surface/accent/grade/text
- `index.html`: Inter + JetBrains Mono fonts
- `frontend/Dockerfile`: build multi-stage Node → Nginx para producción
- `frontend/nginx.conf`: SPA fallback y proxy sin buffer para API/SSE

### 4.2 `src/api/client.js` — API Client

`API_BASE` es vacío por defecto: todas las llamadas usan rutas same-origin (`/api/...`). En desarrollo, Vite las reenvía al backend local; en Docker, Nginx las reenvía al servicio `backend`. `VITE_API_BASE` permite configurar una API remota opcional.

| Función | Descripción |
|---------|-------------|
| `startScan(path, workers)` | POST /api/scan |
| `createScanStream(jobId)` | EventSource /api/scan/{jobId}/stream |
| `exportReport(jobId)` | POST /api/export-html → Blob |

### 4.3 `src/hooks/useAnalysis.js` — Hook Principal

Estados: `idle`, `scanning`, `error`, `empty`, `done`. Variables: `state`, `data`, `progress`, `error`, `errorStatus`, `jobId`.

`startScanFlow(scanPath, workers)`: POST → `setJobId` → SSE → onmessage actualiza progress → oncompleted cierra SSE y guarda data → onerror cierra SSE.

### 4.4 `src/App.jsx` — Componente Raíz

```
<OnboardingModal />
<TopNav />
<main>
  {idle → EmptyStates.Idle}
  {scanning → LoadingState}
  {error+400 → EmptyStates.ScanTooLarge}
  {error → EmptyStates.Error}
  {empty → EmptyStates.NoFiles}
  {done → Dashboard}
</main>
```

### 4.5 Componentes

| Componente | Props | Descripción |
|------------|-------|-------------|
| `OnboardingModal` | `isOpen, onClose` | 4 pasos, localStorage; explica `/workspace` al usar Docker |
| `TopNav` | `path, setPath, workers, setWorkers, onScan, onReset, scanning` | Input + recent paths contextuales + slider + botón |
| `LoadingState` | `progress` | Spinner + cronómetro + barra progreso |
| `EmptyStates` | — | Idle, NoFiles, ScanTooLarge, Error |
| `Dashboard` | `data, jobId` | Contenedor; rutas de archivos omitidos legibles sin truncar |
| `SummaryBar` | `summary, jobId` | Grado + métricas + violaciones + botones Export/Badge |
| `HeatMap` | `files, onSelect` | Treemap Recharts: máx. 300 archivos, etiqueta contextual y tooltip con ruta completa |
| `RadarChart` | `files` | Radar 4 ejes |
| `HallOfShame` | `files, onSelect` | Tabla paginada de 50, ruta contextual y ruta absoluta completa con wrap |
| `CodeViewer` | `file, onClose` | Modal con ruta completa, violaciones + botón 🤖 Refactor (si Ollama) |
| `ScanHistory` | `path, comparison` | LineChart histórico + banner comparación |
| `GitTabs` | `jobId` | Tabs Historial/Blame |
| `TimelineChart` | `commits` | LineChart evolución score por commit |
| `BlameChart` | `blameData` | BarChart horizontal deuda por autor |
| `utils/paths.js` | `shortenPath, fileName` | Formato de rutas compatible con separadores Windows y Unix |

---

## 5. Flujos de Datos

### 5.1 Flujo de Escaneo Exitoso
```
Usuario → TopNav → click "Start Scan"
  → useAnalysis.startScanFlow
  → POST same-origin /api/scan {path, workers}
     (Vite proxy → backend local en desarrollo | Nginx → backend:8000 en Docker)
  → routes.create_scan:
    1. _validate_path (expanduser, abspath, sensitive check)
    2. _cleanup_old_jobs
    3. scanner.discover_files (walk + poda + filtros)
    4. Valida: hay archivos? <5000?
    5. Genera job_id, registra en active_jobs
    6. asyncio.create_task(_run_real_scan)
    7. Retorna {job_id, "started"}
  → Frontend: EventSource /api/scan/{job_id}/stream
  → routes.scan_stream → event_generator (cada 0.5s)
  → _run_real_scan → executor(run_scan_job):
    Para cada archivo: safe_process_file → ast_analyzer → metrics
  → Al completar: aggregate_results → save_scan (SQLite) → compare_with_last
  → SSE emite {status:"completed", result: {summary, files, skipped_files, comparison}}
  → useAnalysis: cierra SSE, state="done"
  → Dashboard → SummaryBar + HeatMap + RadarChart + HallOfShame + ScanHistory + GitTabs
```

### 5.2 Flujo de Error (Path Inválido)
```
POST /api/scan → _validate_path → HTTPException(404)
  → Frontend: setError, state="error"
  → EmptyStates.Error with message + "Retry" button
```

---

## 6. Sistema de Scoring

### Fórmula por Archivo (base 100)
```
score = 100
  - file_size:        -40 (>1000) | -20 (>500) | 0
  - complexity:       -30 (>6 nesting) | -15 (>4) | 0
  - todos:            max((todos/lines)*100 * -2, -20)
  - magic_numbers:    max((magic/lines)*100 * -3, -25)
  - function_complex: -25 (>15 branches) | -10 (>10) | 0
score = max(0, score)
```

### Score del Repositorio
```
average_score = round(sum(file_score * file_lines) / total_lines)
```

### Grados
| Grado | Score | Significado |
|-------|-------|-------------|
| A | 90-100 | Clean Code |
| B | 75-89 | Minor Debt |
| C | 60-74 | High Debt |
| D | 40-59 | Fragile Code |
| F | 0-39 | Biohazard |

---

## 7. God Mode Features

### 7.1 CLI Mode
- `cli.py` con typer + rich
- Barra de progreso en terminal
- Tablas con colores por grado
- `--output json` para CI/CD
- `--fail-below A/B/C/D` para gates de calidad

### 7.2 GitHub Badge
- SVG dinámico con grado y score
- Endpoint `GET /api/badge/{job_id}`
- Botón en SummaryBar para copiar markdown

### 7.3 Export HTML
- Template Jinja2 con TailwindCSS + Chart.js via CDN
- Reporte autocontenido (no necesita servidor)
- Gráfico Radar, Doughnut de violaciones, Bar de distribución
- Tabla de Top Offenders
- Botón 📥 Export en SummaryBar

### 7.4 Git Time Machine
- `GitSafeContext`: stash/restore automático de cambios sin commitear
- Analiza últimos N commits (score por commit)
- `TimelineChart`: LineChart de evolución
- Endpoint `GET /api/scan/{job_id}/history`

### 7.5 Git Blame
- Cruza violaciones con autores via `git blame --line-porcelain`
- `BlameChart`: BarChart horizontal por autor
- Endpoint `GET /api/scan/{job_id}/blame`

### 7.6 IA Local (Ollama)
- Cliente async con httpx
- `check_ollama_status()`: verifica disponibilidad
- `get_refactor_suggestion()`: prompt estricto, solo código
- Botón 🤖 en CodeViewer por violación
- Graceful cuando Ollama no está instalado

---

## 8. 6 Fixes Críticos

### Fix #1: Calibración del Scoring
- `calibrate_scoring.py`: clona 6 repos de referencia, analiza, reporta precisión
- Repos: Click (A), MarkupSafe (A), Flask (B), Requests (B), Django (C), TensorFlow (D)

### Fix #2: Tracking Histórico con SQLite
- `utils/history_db.py`: SQLite en `~/.debtradar/history.db`
- Auto-guarda cada escaneo
- Compara con último scan (score_diff, violations_diff, trend)
- `ScanHistory.jsx`: LineChart + banner de comparación

### Fix #3: GitHub Action
- `action.yml`: metadata del action
- `Dockerfile`: container con DebtRadar
- `.github/workflows/debtradar.yml`: workflow que comenta en PRs
- CLI `--fail-below`: exit code 1 si grade es menor

### Fix #4: Onboarding Modal
- `OnboardingModal.jsx`: 4 pasos, localStorage, barra progreso
- Se muestra solo la primera vez
- "Skip tutorial" or "Get Started" closes and marks as seen

### Fix #5: Pitch Honesto
- README: "Qué Detecta" (7 items) + "Qué NO Detecta" (3 items) + "Por qué Anti-Bloat"
- DEVPOST.md consistente con README

### Fix #6: Path Input UX
- `TopNav.jsx`: recent paths en localStorage (máx 5)
- Dropdown al hacer focus, filtrado por input
- Enter para escanear, Escape para cerrar

---

## 8.1 Fixes de Compatibilidad Windows (post-lanzamiento)

Tras una revisión funcional en vivo del sistema corriendo en Windows, se detectaron y corrigieron 3 defectos relacionados con manejo de rutas dependiente de plataforma. Spec: `.kiro/specs/windows-security-fixes/`.

### Bug #1 (Crítico — Seguridad): Protección de directorios sensibles rota en Windows
- **Síntoma verificado:** `POST /api/scan` con `path: "C:\\Windows\\System32"` respondía `200 OK` en vez de `403`, permitiendo escanear directorios del sistema operativo.
- **Causa raíz:** `SENSITIVE_PATHS` en `routes.py` solo contenía rutas Unix (`/etc`, `/root`, etc.) y la comparación usaba `expanded.startswith(sensitive + "/")`, que nunca coincide con rutas Windows (`C:\Windows\System32` usa `\`, no `/`).
- **Fix:** nuevo módulo `utils/path_security.py::is_sensitive_system_path()`, que compara por contención real de rutas con `pathlib.Path` + `os.path.normcase`, incluyendo directorios sensibles de Windows (`C:\Windows`, `C:\Program Files`, `C:\ProgramData`, etc.) además de los Unix ya existentes.
- **Verificado:** `C:\Windows\System32` y `C:\Program Files` → `403`. Paths normales de usuario siguen devolviendo `200` (sin regresión).

### Bug #2 (Medio — Inconsistencia de seguridad): CLI sin protección de paths sensibles
- **Síntoma:** `cli.py::_run_scan` solo validaba existencia y tipo de directorio, sin ningún chequeo de directorios sensibles (a diferencia de la API).
- **Fix:** `_run_scan` ahora llama a la misma función `is_sensitive_system_path()` que usa la API, saliendo con `typer.Exit(1)` y mensaje de error si el path es sensible.
- **Verificado:** `python cli.py scan C:\Windows\System32` → exit code `1`, sin llamar a `discover_files`.

### Bug #3 (Menor — Cosmético): Acortado de rutas del CLI no funcionaba en Windows
- **Síntoma:** las tablas "Top Offenders" y "All files" del CLI mostraban la ruta absoluta completa (muy larga) en Windows, porque la lógica de acortado buscaba literalmente `"/"` en el string.
- **Fix:** nueva función `_shorten_path()` en `cli.py` basada en `pathlib.Path(path).parts`, multiplataforma. Reemplaza los dos bloques que usaban `split("/")`.
- **Verificado:** en Windows, `C:\Users\...\backend\analyzer\orchestrator.py` ahora se muestra como `backend\analyzer\orchestrator.py` en las tablas.

Los tres fixes se verificaron sin romper el comportamiento existente en Unix/Mac ni el flujo normal de escaneo (scoring, SSE, badge, export, `--fail-below`, etc.).

---

## 8.2 Escalabilidad de resultados y despliegue Docker (post-lanzamiento)

### Rutas largas identificables
- `src/utils/paths.js::shortenPath()` soporta `/` y `\`, conserva los componentes finales y antepone `…\` cuando existe un prefijo omitido.
- `HallOfShame` deja de truncar con CSS: muestra una versión contextual de cuatro componentes y, debajo, la ruta absoluta exacta con `break-all`.
- `Dashboard` aplica la misma estrategia a archivos omitidos; `CodeViewer` permite que la cabecera envuelva la ruta completa.
- `HeatMap` etiqueta los rectángulos con carpeta + archivo cuando cabe, incorpora `<title>` SVG y muestra la ruta completa, sin truncar, en el tooltip. Esto distingue nombres de archivo repetidos entre carpetas largas.
- Las rutas recientes de `TopNav` usan formato contextual y exponen el valor completo con `title`.

### Docker web reproducible
- El `Dockerfile` raíz **no cambió**: sigue reservado a la GitHub Action/CLI.
- `backend/Dockerfile` contiene FastAPI/Uvicorn y Git, necesario para History y Blame.
- `frontend/Dockerfile` construye Vite con Node y sirve los archivos estáticos con Nginx.
- `frontend/nginx.conf` entrega la SPA y reenvía `/api` al servicio `backend`, con buffering desactivado y timeout alto para SSE.
- `docker-compose.yml` publica solo Nginx en `${DEBTRADAR_PORT:-8080}`. La API queda en la red interna; el repositorio del usuario se monta read-only como `/workspace` y el historial SQLite queda en el volumen `debtradar-history`.
- `.env.example` define `SCAN_PATH` y el puerto; `frontend/.dockerignore` evita que `dist` o `node_modules` entren en el contexto de build.

**Verificación realizada en Windows/Docker Desktop:** `docker compose config`, `docker compose build`, healthchecks de ambos servicios, `GET /`, `GET /api/ollama-status` y un escaneo real por Nginx + SSE de `/workspace/backend` (25 archivos, grado B) finalizaron correctamente.

---

## 9. Seguridad y Performance

### 9.1 Seguridad

| Medida | Archivo | Descripción |
|--------|---------|-------------|
| Binding localhost | main.py | 127.0.0.1 only |
| CORS restrictivo | main.py | Solo localhost:5173, GET/POST/OPTIONS, Content-Type |
| API same-origin en producción | client.js + nginx.conf | El navegador no recibe una URL de backend expuesta; Nginx reenvía `/api` internamente |
| Scan mount read-only | docker-compose.yml | El contenedor solo puede leer el repositorio host en `/workspace` |
| Backend no publicado | docker-compose.yml | Solo el frontend Nginx expone el puerto 8080 por defecto |
| Security headers | main.py | nosniff, DENY, no-referrer |
| Rate limiting | routes.py | Máximo 5 escaneos simultáneos (429) |
| Path validation | routes.py + utils/path_security.py | os.path.abspath, bloquea directorios sensibles multiplataforma (Unix y Windows) |
| Path validation (CLI) | cli.py + utils/path_security.py | Misma protección de directorios sensibles que la API, aplicada también al CLI |
| Sensitive files | scanner.py | .env, .pem, .key, id_rsa, secrets.json |
| Symlink protection | scanner.py | followlinks=False |
| Depth limit | scanner.py | MAX_DEPTH = 20 |
| File size limit | scanner.py | MAX_FILE_SIZE_BYTES = 1MB |
| No code logging | Todos | Contenido nunca se loggea |
| SSE disconnect | routes.py | Job → cancelled, cleanup en 5s |
| Git safety | git_utils.py | stash/restore en finally |

### 9.2 Performance

| Optimización | Archivo | Descripción |
|-------------|---------|-------------|
| Parser initializer | orchestrator.py | Precarga parsers una vez por worker |
| ProcessPoolExecutor | orchestrator.py | CPU-bound correcto |
| Early termination | orchestrator.py | Cancelación en secuencial y paralelo |
| Single file read | ast_analyzer.py | Lee archivo una sola vez |
| Minified 1KB | scanner.py | Lee solo primeros 1KB |
| Poda in-place | scanner.py | No crea copias de dirnames |
| Extension filter first | scanner.py | Filtra antes de I/O |
| Job cleanup | routes.py | Máx 100 jobs, cleanup automático |
| Hall of Shame paginado | HallOfShame.jsx | Solo 50 filas iniciales; "Load more" evita miles de nodos DOM |
| Heat map acotado | HeatMap.jsx | Máx. 300 rectángulos SVG, priorizando archivos grandes |

---

## 10. Manejo de Edge Cases

| Caso | Dónde se maneja | Comportamiento |
|------|-----------------|----------------|
| Path no existe | routes._validate_path | HTTP 404 |
| Path no es directorio | routes._validate_path | HTTP 400 |
| Path vacío | routes._validate_path | HTTP 400 |
| Path sensible (/etc, C:\Windows, etc.) | routes._validate_path / cli._run_scan → utils.path_security | HTTP 403 (API) / exit code 1 (CLI), multiplataforma |
| Path traversal | routes._validate_path | Normalizado con abspath |
| Ruta Docker | docker-compose.yml + OnboardingModal | El host se monta read-only como `/workspace`; la UI explica usar esa ruta interna |
| Sin archivos | routes.create_scan | HTTP 404 |
| >5000 archivos | routes.create_scan | HTTP 400 |
| >5 escaneos simultáneos | routes.create_scan | HTTP 429 |
| Archivo sensible | scanner._is_sensitive_file | Skipped |
| Archivo >1MB | scanner.discover_files | Skipped |
| Archivo minificado | scanner.is_minified_file | Skipped |
| Archivo oculto | scanner.discover_files | Skipped |
| Profundidad >20 | scanner.discover_files | Directorio podado |
| .gitignore | scanner._load_gitignore | Respetado |
| Symlink roto | scanner.discover_files | Skipped |
| Archivo vacío | ast_analyzer.analyze_file | None → fallback |
| Encoding no UTF-8 | ast_analyzer.analyze_file | errors='ignore' |
| UTF-8 BOM | ast_analyzer.analyze_file | Manejado |
| Archivo binario | Por extensión | Skipped |
| Archivo inexistente | orchestrator.safe_process_file | skipped: True |
| Timeout por archivo | orchestrator.run_scan_job | skipped: True |
| Error de worker | orchestrator.run_scan_job | skipped: True |
| Job cancelado | orchestrator.run_scan_job | Early termination |
| Cliente SSE desconectado | routes.scan_stream | cancelled + cleanup |
| Memory leak (jobs) | routes._cleanup_old_jobs | Limpieza automática |
| Caracteres control AST | ast_analyzer._safe_text | Limpieza \n \r \t |
| Ollama no disponible | llm_client.check_ollama_status | Graceful: available: false |

---

## 11. Configuración y Deployment

### Requisitos
- **Modo local:** Python 3.11+, Node.js 18+ y npm.
- **Modo Docker (recomendado para reproducibilidad):** Docker Desktop con Docker Compose. No requiere Python ni Node en el host.

### Instalación y ejecución local
```bash
# Backend
cd backend && python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000

# En otra terminal: frontend
cd frontend && npm install && npm run dev

# CLI (opcional, desde la raíz)
pip install -e .
debtradar scan /path/to/repo --workers 4 --output json --fail-below B
```

Vite reenvía `/api` al backend local en el puerto 8000. El frontend no contiene URLs rígidas de `127.0.0.1`; si se necesita una API remota puede configurarse `VITE_API_BASE` antes de compilar.

### Ejecución Docker (frontend + API)
```powershell
# En la raíz del repositorio (Windows)
Copy-Item .env.example .env
# Opcional: editar .env, p. ej. SCAN_PATH=C:/Users/you/source/my-project

docker compose up --build
```

En macOS/Linux: `cp .env.example .env`. Abre `http://localhost:8080` y usa **`/workspace`** en el input de ruta. Compose monta `SCAN_PATH` en esa ubicación solo para lectura; por tanto se debe indicar la ruta del contenedor, no `C:\...` o el path nativo del host.

```bash
# Ver estado / detener el stack (el volumen de historial se conserva)
docker compose ps
docker compose down
```

Topología de producción local:
```
Browser → localhost:8080 → Nginx (frontend)
                             └→ /api + SSE → backend:8000 (red interna)
                                              └→ /workspace (bind mount read-only)
                                              └→ debtradar-history (volumen SQLite)
```

El `Dockerfile` de la raíz sigue destinado exclusivamente a la GitHub Action; no usarlo para arrancar la aplicación web.

### Dependencias Backend
```
fastapi, uvicorn, pydantic, pathspec, tree-sitter,
tree-sitter-python, tree-sitter-javascript, tree-sitter-typescript,
typer, rich, jinja2, httpx
```

---

## 12. Estructura de Archivos Final

```
debt-radar/
├── README.md                                    # Documentación completa + pitch honesto
├── DEVPOST.md                                   # Preparación Devpost
├── CONTEXT.md                                   # Este documento
├── pyproject.toml                               # Config para pip install -e .
├── .env.example                                 # SCAN_PATH y DEBTRADAR_PORT para Compose
├── .dockerignore                                # Excluye entornos y artefactos del build backend
├── docker-compose.yml                           # Stack Nginx + FastAPI, volumen e input read-only
├── Dockerfile                                   # Container para GitHub Action (CLI; se conserva separado)
├── action.yml                                   # Metadata GitHub Action
├── .github/workflows/debtradar.yml              # Workflow CI/CD
├── backend/
│   ├── Dockerfile                               # Uvicorn + Git para el servicio API
│   ├── main.py                                  # FastAPI + CORS + security headers
│   ├── cli.py                                   # CLI con typer + rich
│   ├── calibrate_scoring.py                     # Script de calibración
│   ├── requirements.txt                         # 12 dependencias
│   ├── api/
│   │   ├── routes.py                            # 9 endpoints REST + SSE
│   │   └── schemas.py                           # 10 modelos Pydantic
│   ├── analyzer/
│   │   ├── scanner.py                           # discover_files + poda + filtros
│   │   ├── orchestrator.py                      # ProcessPoolExecutor + AST
│   │   ├── metrics.py                           # Scoring + agregación + comparison
│   │   ├── git_history.py                       # Análisis de commits
│   │   └── git_blame.py                         # Deuda por autor
│   ├── parsers/
│   │   ├── parser_pool.py                       # Tree-sitter PY/JS/TS/TSX
│   │   ├── ast_analyzer.py                      # AST iterativo + ubicaciones
│   │   └── regex_patterns.py                    # TODO/FIXME case-sensitive
│   ├── templates/
│   │   └── report.html                          # Template Jinja2 + Chart.js
│   └── utils/
│       ├── badges.py                            # Generador SVG badges
│       ├── report_generator.py                  # Export HTML
│       ├── git_utils.py                         # GitSafeContext + blame + log
│       ├── llm_client.py                        # Cliente Ollama
│       ├── history_db.py                        # SQLite tracking histórico
│       └── path_security.py                     # Paths sensibles multiplataforma (API + CLI)
├── frontend/
│   ├── Dockerfile                               # Build Vite multi-stage + Nginx
│   ├── .dockerignore                            # Excluye node_modules y dist del contexto
│   ├── nginx.conf                               # SPA fallback + proxy /api y SSE
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx
│       ├── index.css
│       ├── App.jsx
│       ├── api/client.js                         # API same-origin; VITE_API_BASE opcional
│       ├── utils/paths.js                        # Rutas Windows/Unix legibles
│       ├── hooks/useAnalysis.js
│       └── components/
│           ├── OnboardingModal.jsx              # 4 pasos, localStorage
│           ├── TopNav.jsx                       # Input + recent paths + slider
│           ├── Dashboard.jsx                    # Contenedor principal
│           ├── SummaryBar.jsx                   # Métricas + Export + Badge
│           ├── HeatMap.jsx                      # Treemap
│           ├── RadarChart.jsx                   # Radar 4 ejes
│           ├── HallOfShame.jsx                  # Tabla archivos
│           ├── CodeViewer.jsx                   # Modal violaciones + 🤖 Refactor
│           ├── LoadingState.jsx                 # Spinner + cronómetro
│           ├── EmptyStates.jsx                  # Idle, NoFiles, ScanTooLarge, Error
│           ├── ScanHistory.jsx                  # Histórico + comparación
│           ├── GitTabs.jsx                      # Tabs Historial/Blame
│           ├── TimelineChart.jsx                # Evolución score por commit
│           └── BlameChart.jsx                   # Deuda por autor
└── .openclaw/tmp/                               # Archivos temporales
```

### Estadísticas del proyecto
- **~55 archivos** de código
- **~5,500 líneas** de código
- **9 endpoints** REST + SSE
- **14 componentes** React
- **5 módulos** de utilidades
- **6 fixes** críticos implementados
- **~50 pruebas** automatizadas (96/98 pasan)
