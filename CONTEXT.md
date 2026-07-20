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
- `tailwind.config.js`: dark mode, colores surface(0-5)/accent/grade(text+bg)/text/semantic success-warning-error-info, font sizes (eyebrow/caption/body-sm/body/lead), border radius (card/pill), shadows (card/card-hover/modal/dropdown), animations (fade-in/slide-up/scale-in/progress-pulse)
- `index.css`: `@layer components` con 15+ clases (card, btn-primary/secondary/ghost/danger, badge/badge-a--f, pill-high/medium/low, input, section-header, tooltip-content, empty-state, modal-overlay/backdrop/content/header/body/footer). Soporte `prefers-reduced-motion`, scroll personalizado, selection highlight, focus-visible global.
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
| `OnboardingModal` | `isOpen, onClose` | 4 pasos visuales con iconos, highlights, ejemplos de rutas (Windows/Mac/Docker), barra de progreso, localStorage |
| `TopNav` | `path, setPath, workers, setWorkers, onScan, onReset, scanning` | Logo profesional + subtítulo "Code Health Auditor", input con badge Docker, workers slider, paths recientes con tooltip, botón Scan/Cancel responsivo |
| `LoadingState` | `progress` | SVG circular animado, fases (discovering/analyzing/aggregating), cronómetro formateado, `aria-live="polite"` |
| `EmptyStates` | — | 4 variantes (Idle con SVG personalizado, NoFiles, ScanTooLarge, Error) con icono, título humano, descripción, acción específica, detalles técnicos expandibles, botón "Copy error" |
| `Dashboard` | `data, jobId` | Breadcrumb + timestamp, botón "View worst files ↓" con scroll suave, layout vertical progresivo |
| `SummaryBar` | `summary, jobId, comparison?` | Hero grade (6xl-7xl) con label + descripción + tendencia (📈/📉/➡️), grid métricas 2x2, distribución grados, chips violaciones, botones Export/Badge |
| `HeatMap` | `files, onSelect` | Treemap Recharts: leyenda A-F, tooltip con grade badge, grade letter en celdas pequeñas, máx. 300 archivos |
| `RadarChart` | `files` | Radar 4 ejes con tooltip descriptivo, métricas (Complejidad/TODOs/Magic Numbers/God Files), fallback sin datos |
| `HallOfShame` | `files, onSelect` | Tabla paginada de 50, filtros por grado (A-F con contadores), ordenación worst-first, StatusPills para violaciones, ruta contextual + completa |
| `CodeViewer` | `file, onClose` | Modal con 3 tabs (Issues/Deductions/Refactor), breadcrumb con lenguaje+score+lines, focus trap (Tab/Shift+Tab), Escape to close, foco restaurado, Ollama status graceful |
| `ScanHistory` | `path, comparison` | LineChart histórico con banner comparación por color (verde/rojo/gris), tooltip, leyenda grados |
| `GitTabs` | `jobId` | Tabs Historial/Blame con loading/error states, advertencia contextual |
| `TimelineChart` | `commits` | LineChart evolución score con tooltip + grade badge, empty state |
| `BlameChart` | `blameData` | BarChart horizontal deuda por autor, tooltip con StatusPills por tipo, top 10 ordenado |
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
│   ├── tailwind.config.js                        # 40+ tokens de diseño
│   ├── postcss.config.js
│   └── src/
│       ├── main.jsx
│       ├── index.css                            # @layer components completo
│       ├── App.jsx
│       ├── api/client.js                         # API same-origen; VITE_API_BASE opcional
│       ├── utils/paths.js                        # Rutas Windows/Unix legibles
│       ├── hooks/useAnalysis.js
│       ├── components/
│       │   ├── ui/
│       │   │   ├── Badge.jsx                    # GradeBadge + SeverityBadge
│       │   │   ├── Card.jsx                     # Card con variantes (default/elevated/interactive)
│       │   │   ├── Button.jsx                   # Button con variantes (primary/secondary/ghost/danger)
│       │   │   ├── EmptyState.jsx               # Estado vacío reutilizable con technical details
│       │   │   ├── SectionHeader.jsx            # Encabezado con acción opcional
│       │   │   └── StatusPill.jsx               # Píldoras de tipo de violación
│       │   ├── OnboardingModal.jsx              # 4 pasos visuales, localStorage
│       │   ├── TopNav.jsx                       # Logo + input + workers + paths recientes
│       │   ├── Dashboard.jsx                    # Contenedor principal con scroll-to-hall
│       │   ├── SummaryBar.jsx                   # Hero grade + métricas + tendencia
│       │   ├── HeatMap.jsx                      # Treemap con leyenda A-F
│       │   ├── RadarChart.jsx                   # Radar 4 ejes descriptivo
│       │   ├── HallOfShame.jsx                  # Tabla con filtros por grado
│       │   ├── CodeViewer.jsx                   # Modal con tabs + focus trap
│       │   ├── LoadingState.jsx                 # SVG circular + fases + aria-live
│       │   ├── EmptyStates.jsx                  # 4 variantes con EmptyState component
│       │   ├── ScanHistory.jsx                  # Histórico + comparación
│       │   ├── GitTabs.jsx                      # Tabs Historial/Blame
│       │   ├── TimelineChart.jsx                # Evolución score por commit
│       │   └── BlameChart.jsx                   # Deuda por autor
│       └── dist/                                 # Build de producción (generado)
│           ├── index.html
│           ├── assets/                           # CSS + JS minificados
```

### Estadísticas del proyecto
- **~62 archivos** de código (incluyendo 6 componentes UI en `components/ui/`)
- **~6,200 líneas** de código
- **9 endpoints** REST + SSE
- **20 componentes** React (14 principales + 6 base UI)
- **5 módulos** de utilidades
- **6 fixes** críticos implementados
- **~50 pruebas** automatizadas (96/98 pasan)


---

## 13. Estado actual posterior a la publicación y plan de profesionalización de la interfaz

### 13.1 Correcciones recientes ya implementadas

#### Manejo de errores de escaneo y arranque local

La interfaz ya no convierte silenciosamente una respuesta inválida, HTML de un proxy o una caída de red en `Unknown error`.

- `frontend/src/api/client.js::startScan()` ahora:
  - Conserva el status HTTP y el texto real de la respuesta.
  - Intenta interpretar JSON, pero también acepta texto plano o HTML de error.
  - Muestra si el backend no es accesible y recuerda que debe ejecutarse en el puerto 8000.
  - Detecta respuestas exitosas que no contienen JSON válido.
- `frontend/src/hooks/useAnalysis.js` muestra un mensaje específico si el stream SSE no puede conectarse después de crear el job.
- `backend/start_server.py` usa el puerto 8000, alineado con el proxy de Vite, el comando local documentado y el API client.
- El arranque correcto en Windows usa el entorno virtual del backend:
  ```powershell
  .\venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
  ```
- Causa del error observado en la captura: la ruta `C:\Users\javie\OneDrive\Documentos\IA\Apps de IA\ReferralNow` no existe y, en ese momento, tampoco había un backend escuchando. La ruta local válida de Debt-radar es la carpeta raíz del proyecto; en Docker es `/workspace`.

#### Verificación posterior

- Build del frontend después de las correcciones: correcto; permanece únicamente el warning no bloqueante de bundle superior a 500 kB.
- API local con el entorno virtual: healthcheck correcto.
- Escaneo local de la raíz de Debt-radar: **48 archivos, grado B**.
- Docker Compose reconstruido después de las correcciones: correcto.
- Frontend Docker: `http://127.0.0.1:8080/`.
- Backend Docker: red interna en `backend:8000`.
- Healthchecks del frontend y backend: correctos.
- Escaneo real vía Nginx + SSE usando `/workspace`: **48 archivos, grado B**.

#### Estado de GitHub y documentación de Devpost

- Repositorio público: `https://github.com/jamonesjamonesjamones-max/debt-radar`.
- `DEVPOST.md` fue retirado del repositorio público y añadido a `.gitignore`; permanece solo como copia local para preparar el formulario de Devpost.
- `.envlocal` nunca fue incluido en el índice ni en GitHub; el valor local del token fue eliminado después de publicar. Las credenciales de publicación no forman parte del proyecto.
- El commit que contiene la corrección del cliente y del puerto es `42db130`.
- `README.md` sí permanece publicado y contiene las instrucciones de instalación local y Docker.

### 13.2 Profesionalización de la interfaz — Implementación completada

Se implementaron las 8 etapas del plan de profesionalización. A continuación el estado de cada etapa:

#### ✅ Etapa 0 — Auditoría visual y contrato de estados
**Completado.** Se inventariaron los 10+ estados del sistema. Cada estado tiene: título humano, explicación, acción principal, acción secundaria, icono y detalles técnicos expandibles. Archivos: `EmptyStates.jsx`, `LoadingState.jsx`, `ErrorBoundary.jsx`. Ningún estado muestra pantalla vacía o error sin contexto.

#### ✅ Etapa 1 — Design system visual centralizado
**Completado.** 
- `tailwind.config.js`: 40+ tokens de diseño (surface-5, semantic colors, grade backgrounds, font sizes, border radius, shadows, animations)
- `index.css`: `@layer components` completo con 15+ clases reutilizables
- `src/components/ui/`: 6 componentes base — `Badge.jsx` (GradeBadge + SeverityBadge), `Card.jsx`, `Button.jsx`, `EmptyState.jsx`, `SectionHeader.jsx`, `StatusPill.jsx`

#### ✅ Etapa 2 — Header y flujo de inicio de escaneo
**Completado.** `TopNav.jsx` rediseñado con: logo + subtítulo "Code Health Auditor", badge Docker contextual, placeholder local/Docker, workers slider con label, paths recientes con tooltip, botón Scan/Cancel responsivo, layout mobile-friendly.

#### ✅ Etapa 3 — Onboarding + Carga + Errores
**Completado.** 
- `OnboardingModal.jsx`: 4 pasos visuales con iconos, highlights, ejemplos de rutas (Windows/Mac/Docker), barra de progreso con porcentaje
- `LoadingState.jsx`: SVG circular animado, fases (discovering/analyzing/aggregating), cronómetro, `aria-live="polite"`
- `EmptyStates.jsx`: 4 variantes con SVG personalizado, acciones específicas, detalles técnicos expandibles, botón "Copy error"
- `ErrorBoundary.jsx`: Detalles colapsables, botón "Back to start"

#### ✅ Etapa 4 — Dashboard + SummaryBar
**Completado.** 
- `Dashboard.jsx`: Breadcrumb + timestamp, botón "View worst files ↓" con scrollIntoView, layout vertical progresivo
- `SummaryBar.jsx`: Hero grade grande con label + descripción + tendencia (📈/📉/➡️), grid métricas 2x2, distribución grados, chips violaciones, botones Export/Badge

#### ✅ Etapa 5 — Visualizaciones con propósito
**Completado.** 
- `HeatMap.jsx`: Leyenda A-F visible, tooltip con grade badge, grade letter en celdas pequeñas, máx 300 archivos
- `RadarChart.jsx`: Tooltip con descripción de métricas, fallback sin datos
- `ScanHistory.jsx`: Banner comparación con color de borde (verde/rojo/gris), leyenda grados
- `TimelineChart.jsx`: Tooltip con grade badge, empty state, líneas de referencia por grado
- `BlameChart.jsx`: Ordenado por violaciones descendente, breakdown por tipo en tooltip con StatusPills

#### ✅ Etapa 6 — Ranking + CodeViewer
**Completado.**
- `HallOfShame.jsx`: Filtros por grado (A-F con contadores), ordenación worst-first, paginación 50, ruta contextual + completa, StatusPills, hover/focus states
- `CodeViewer.jsx`: 3 tabs (Issues/Deductions/Refactor), breadcrumb con lenguaje+score+lines, focus trap (Tab/Shift+Tab), Escape to close, foco restaurado, Ollama status graceful

#### ✅ Etapa 7 — Accesibilidad y microinteracciones
**Completado.** `interactive-transition` global, animaciones (fade-in/slide-up/scale-in), `prefers-reduced-motion`, focus-visible global, `aria-live` en LoadingState, `aria-label`/`aria-modal`/`role="dialog"` en modales, botones con áreas táctiles adecuadas.

#### ✅ Etapa 8 — Build y validación
**Completado.** `npx vite build` → 667 módulos transformados, 0 errores. CSS: 34KB (gzip: 6KB), JS: 642KB (gzip: 183KB). Code review completado sin issues críticos.

### 13.3 Auditoría de errores de UI en apps de "Vibe Coding" — Realizada

Se investigaron y documentaron los **7 errores capitales de UI/UX** que cometen las aplicaciones generadas con asistentes de IA, basándose en búsqueda web y análisis de patrones recurrentes:

| # | Error | Descripción |
|---|-------|-------------|
| 1 | **Ausencia de feedback y transiciones** | Spinners, barras de progreso, estados intermedios olvidados |
| 2 | **Arquitectura de información plana** | Sin jerarquía visual entre acciones primarias/secundarias/terciarias |
| 3 | **Falta de accesibilidad (WCAG)** | Contraste insuficiente, áreas táctiles <44px, sin focus-visible |
| 4 | **La trampa de la regeneración** | Botones que destruyen trabajo previo sin historial ni undo |
| 5 | **Inconsistencia visual** | Ausencia de design system: paddings, radios, colores arbitrarios |
| 6 | **Diseño responsive ausente** | Tablas que desbordan en móvil, layouts rotos <768px |
| 7 | **Manejo de errores pobre** | Errores genéricos sin acción de recuperación, pantallas en blanco |

#### Evaluación de DebtRadar contra estos errores

| Error | Estado | Detalle |
|-------|--------|---------|
| #1: Feedback | ✅ **Resuelto** | LoadingState con fases + cronómetro, SSE progresivo cada 0.5s |
| #2: Arquitectura info | ✅ **Resuelto** | Dashboard con scroll-to-hall-of-shame, jerarquía vertical progresiva |
| #3: Accesibilidad | ✅ **Resuelto** | Focus-visible global, aria-live, aria-modal, prefers-reduced-motion, 44px botones |
| #4: Regeneración | N/A | No aplica: la app no tiene funcionalidad "regenerar" destructiva |
| #5: Consistencia | ✅ **Resuelto** | Design system unificado con 40+ tokens y 6 componentes base |
| #6: Diseño responsive | ✅ **Resuelto** | Tablas desktop → tarjetas móvil, modales responsivos con mx-2 y max-h-[90vh] |
| #7: Manejo de errores | ✅ **Resuelto** | 7+ escenarios de error con mensajes humanos + acciones de recuperación + Copy error |

**Puntuación: 6/7 errores resueltos** (1 no aplica). DebtRadar está muy por encima del promedio de apps generadas con asistentes de IA.

### 13.4 Correcciones de profesionalización de la interfaz — Implementadas

Basándose en la auditoría de errores de UI, se implementaron las siguientes correcciones:

#### ✅ Fix #1: Tablas responsivas en HallOfShame
- **Antes**: Tabla desktop que se desbordaba horizontalmente en móvil (<768px)
- **Después**: Vista dual — `hidden md:block` para tabla desktop con scroll horizontal controlado + `md:hidden` para tarjetas móviles con rank, ruta contextual, lenguaje, líneas, grade badge, score y StatusPills
- **Archivo**: `HallOfShame.jsx`

#### ✅ Fix #2: aria-describedby en validación de input (TopNav)
- **Antes**: Input de ruta sin feedback de validación para lectores de pantalla
- **Después**: `aria-describedby` condicional con hint descriptivo, `aria-invalid`, y span `sr-only` con texto alternativo según modo (Docker/local)
- **Archivo**: `TopNav.jsx`

#### ✅ Fix #3: Animaciones escalonadas en Dashboard
- **Antes**: Todas las secciones del Dashboard aparecían simultáneamente
- **Después**: Staggered fade-in con delays progresivos (0s, 0.1s, 0.15s, 0.25s, 0.35s, 0.4s) y `animationFillMode: 'both'` para que cada sección aparezca secuencialmente
- **Archivo**: `Dashboard.jsx`

#### ✅ Fix #4: Experiencia responsive de CodeViewer modal
- **Antes**: Modal sin márgenes en móvil, altura fija susceptible de desbordar el viewport
- **Después**: `mx-2 sm:mx-0` para márgenes horizontales en móvil + `max-h-[90vh] sm:max-h-[85vh]` para mejor uso del viewport
- **Archivo**: `CodeViewer.jsx`

#### ✅ Fix #5: Variable muerta eliminada en SummaryBar
- **Antes**: Variable `const key = summary.grade_distribution;` declarada pero nunca usada dentro del `.map()` de distribución de grados
- **Después**: Variable eliminada. `summary.grade_distribution` ya se accede correctamente via `summary.grade_distribution[g]` en la línea superior
- **Archivo**: `SummaryBar.jsx`

#### Build verificado
- `npx vite build` → 667 módulos, 0 errores
- Preview con backend vivo: funcionando correctamente
- Code review completo sin issues críticos

### Pendientes para futuro (mejoras no críticas)
- Filtros por lenguaje y tipo de violación en HallOfShame
- Controles de ordenación explícitos (por score/líneas/nombre)
- Health-check visual del backend en TopNav
- Code-splitting de Recharts para reducir bundle
- Tests automatizados de frontend

---

*Última actualización: 17 julio 2026*
### 13.5 Skills de UI instaladas y mejoras finales de interfaz — Implementado

Se investigaron, seleccionaron e instalaron **6 skills** para mejorar la interfaz de forma profesional:

| Skill | Origen | Instalaciones | Propósito |
|-------|--------|:-----------:|-----------|
| **ui-ux-pro-max** | nextlevelbuilder | 272K | Base de datos de diseño: 192 paletas, 74 fonts, 84 estilos, 98 guías UX, 25 tipos de charts |
| **high-end-visual-design** | leonxlnx/taste-skill | 207.2K | Patrones de diseño tipo agencia premium ($150k) con Double-Bezel, micro-interacciones |
| **improve-animations** | emilkowalski/skills | 15.9K | Auditoría y plan de animaciones (Emil Kowalski, ex-Framer) |
| **animation-vocabulary** | emilkowalski/skills | 32.3K | Diccionario de términos de animación |
| **accessibility** | addyosmani/web-quality-skills | 37.1K | Guía completa WCAG 2.2 (Addy Osmani, Google Chrome) |
| **responsive-design** | wshobson/agents | 14.9K | Container queries, tipografía fluida, CSS Grid |

#### Mejoras implementadas usando las skills

| # | Mejora | Skill Origen | Archivos |
|---|-------|:-----------:|----------|
| 1 | **Sistema de 30+ iconos SVG** reemplazando todos los emojis | high-end-visual-design | `Icons.jsx`, 11 componentes |
| 2 | **Animaciones premium**: spring-up, shimmer, pulse-soft, breathe, radar-sweep, card-enter, hover-lift, magnetic-press | improve-animations | `tailwind.config.js`, `index.css` |
| 3 | **Transiciones custom cubic-bezier** (cubic-bezier(0.32, 0.72, 0, 1)) en todas las animaciones | high-end-visual-design | `tailwind.config.js` |
| 4 | **Double-Bezel card architecture**: card-premium con borde gradiente via mask-composite, card-outer con shell gradiente | high-end-visual-design | `index.css` |
| 5 | **Tipografía fluida**: tamaños display-sm/display/display-lg con clamp() | responsive-design | `tailwind.config.js` |
| 6 | **font-display** en hero grade de SummaryBar usando display-lg + font-display | high-end-visual-design | `SummaryBar.jsx` |
| 7 | **card-premium** en SummaryBar, HeatMap, HallOfShame, RadarChart, ScanHistory | high-end-visual-design | 5 componentes |
| 8 | **btn-magnetic**: hover translateY(-1px) + active scale(0.97) en todos los botones principales | high-end-visual-design | 7 componentes |
| 9 | **card-lift**: hover translateY(-3px) + shadow profundo en cards clickeables | high-end-visual-design | `index.css` |
| 10 | **General Sans** como fuente display premium (FontShare API) | high-end-visual-design | `index.html`, `tailwind.config.js` |
| 11 | **Skip link** de accesibilidad (visible solo al recibir foco con teclado) | accessibility | `index.html`, `index.css` |
| 12 | **aria-hidden** en iconos SVG decorativos (TurtleIcon, RocketIcon, etc.) | accessibility | `TopNav.jsx` |
| 13 | **Staggered entry animations** en filas y cards de HallOfShame | improve-animations | `HallOfShame.jsx` |

#### Componentes actualizados (totales acumulados)

| Archivo | Mejoras aplicadas |
|---------|-------------------|
| `tailwind.config.js` | 13 animaciones, 3 tamaños display fluidos, font-display, cubic-bezier global |
| `index.css` | card-premium, card-outer, card-lift, btn-magnetic, skip-link, shimmer-block |
| `Icons.jsx` | 30+ iconos SVG (nuevo archivo) |
| `SummaryBar.jsx` | card-premium, animate-card-enter, font-display hero grade, btn-magnetic |
| `TopNav.jsx` | btn-magnetic, aria-hidden en iconos decorativos |
| `HallOfShame.jsx` | card-premium, animate-fade-in staggered, card-lift mobile, btn-magnetic pagination |
| `HeatMap.jsx` | card-premium |
| `RadarChart.jsx` | card-premium (x2: empty state + data) |
| `ScanHistory.jsx` | card-premium, animate-fade-in con delay |
| `Dashboard.jsx` | btn-magnetic en scroll button |
| `EmptyStates.jsx` | btn-magnetic en retry button |
| `ErrorBoundary.jsx` | btn-magnetic en "Back to start" |
| `CodeViewer.jsx` | btn-magnetic en Close |
| `index.html` | General Sans font, skip link |

#### Build: 668 modules, 0 errores ✅

#### Pendientes (menor prioridad)
- Container queries en componentes Dashboard (requiere reestructuración mayor)
- btn-magnetic en OnboardingModal y GitTabs (botones de navegación)

### 13.6 Verificación exhaustiva de funciones — Completada

Se realizó una revisión parte por parte de toda la aplicación para verificar que todas las funciones operan correctamente después de las modificaciones de interfaz.

#### Build
- **668 módulos transformados, 0 errores** ✅

#### Core Infrastructure (sin modificar)
| Archivo | Estado | Verificación |
|---------|:------:|--------------|
| `App.jsx` | ✅ Intacto | State machine: idle→scanning→done\|error\|empty |
| `useAnalysis.js` | ✅ Intacto | SSE handling, startScan, reset, estados progreso |
| `api/client.js` | ✅ Intacto | startScan, createScanStream, exportReport |

#### Component Props (todos preservados)
| Componente | Props | Estado |
|-----------|-------|:------:|
| TopNav | path, setPath, workers, setWorkers, onScan, onReset, scanning | ✅ |
| Dashboard | data, jobId | ✅ |
| SummaryBar | summary, jobId, comparison? | ✅ |
| HeatMap | files, onSelect | ✅ |
| RadarChart | files | ✅ |
| HallOfShame | files, onSelect | ✅ |
| CodeViewer | file, onClose | ✅ |
| ScanHistory | path, comparison | ✅ |
| GitTabs | jobId | ✅ |
| TimelineChart | commits | ✅ |
| BlameChart | blameData | ✅ |
| LoadingState | progress | ✅ |
| EmptyStates | Idle, NoFiles, ScanTooLarge, Error | ✅ |
| ErrorBoundary | children, onReset | ✅ |
| OnboardingModal | isOpen, onClose | ✅ |

#### Data Flow & Event Handling
| Flujo | Estado |
|-------|:------:|
| onSelect (HeatMap) → setSelectedFile → CodeViewer | ✅ |
| onClose (CodeViewer) → setSelectedFile(null) | ✅ |
| onScan/onReset (TopNav) → startScan/reset (useAnalysis) | ✅ |
| Keyboard: Escape en CodeViewer | ✅ |
| Keyboard: Tab focus trap en CodeViewer | ✅ |
| Keyboard: Enter/Space en HallOfShame rows | ✅ |
| Export report + Badge copy (SummaryBar) | ✅ |
| SSE streaming | ✅ |
| Ollama integration (3 estados: loading/available/unavailable) | ✅ |
| Git tabs (History/Blame fetch on switch) | ✅ |

#### Veredicto final: Sin regresiones. Todas las funciones operan correctamente. ✅


## 14 — Loop de Mejoras de Intuitividad (Jul 2026)

### 14.1 Dashboard Executive Summary
- **Nuevo**: Componente `ExecutiveSummary` en `Dashboard.jsx`
- Muestra resumen en lenguaje natural: grade, total files, violations, avg score, worst file
- 4 métricas clave en grid responsive + worst file highlight con score
- Insertado después de SummaryBar, usa datos existentes de `data.summary` y `data.files`

### 14.2 Onboarding Reactivable
- `App.jsx`: Nueva función `handleShowTutorial()` que resetea `showOnboarding = true`
- `TopNav.jsx`: Nuevo prop `onShowTutorial`, botón con `QuestionIcon` (SVG) junto al formulario
- Solo visible cuando `!scanning`, label: "Show tutorial again"

### 14.3 Sistema de Tooltips
- Icons.jsx: Nuevo `InfoIcon` (círculo con "i") exportado
- Preparado para usar en todas las secciones como botón de ayuda contextual

### 14.4 Skeleton Loading
- `Card.jsx`: Nuevos componentes `SkeletonBlock` y `SkeletonCard`
- `SkeletonBlock`: Placeholder shimmer con className/count configurables
- `SkeletonCard`: Card completo con header shimmer + N líneas
- Usa clase `shimmer-block` existente en index.css
- Disponible para integración futura en Dashboard sections

### 14.5 Build Status
- Build exitoso: 659 KB JS, 35.86 KB CSS, 4.23s
- Preview sin errores de consola
- Todos los componentes existentes intactos
- Sin emojis, todos los iconos son SVG con aria-hidden


## 14. Loop de 10 iteraciones - Mejoras finales de interfaz

Se realizaron 10 iteraciones de mejora continua sobre la interfaz de DebtRadar:

### Loops completados

**Loop 1 - TopNav + Skeleton Infrastructure** - Corregida indentacion del boton tutorial. Eliminado duplicado de </header>. Skeleton loading anadido y posteriormente eliminado por ser codigo muerto.

**Loop 2 - InfoTooltip System** - Nuevo componente InfoTooltip.jsx integrado en HeatMap, RadarChart, HallOfShame y ExecutiveSummary. Tooltips contextuales con hover/foco y posicionamiento configurable.

**Loop 3 - Confetti Celebration** - Nuevo ConfettiOverlay.jsx con 40 particulas CSS animadas. Integrado en App.jsx con deteccion de transicion scanning a done.

**Loop 4 - Sticky Sidebar** - No implementado (requiere reestructuracion mayor del Dashboard).

**Loop 5 - Mobile Responsiveness** - Iconos de tendencia ocultos en movil en SummaryBar.

**Loop 6 - Glossary Tooltips** - InfoTooltips en metricas Files Scanned e Issues Found con explicaciones.

**Loop 7 - Timeline and Blame Charts** - Corregidos errores de sintaxis (duplicados </div>). Restaurados export default.

**Loop 8 - Worst File Highlight** - Tarjeta mejorada con badge de score /100, indicador Needs attention, conteo de issues y lineas.

**Loop 9 - Polish Transitions** - Animaciones escalonadas con animate-card-enter para HeatMap, RadarChart y HallOfShame.

**Loop 10 - Dead Code Removal + Documentation** - Eliminado skeleton loading muerto. Documentacion actualizada.

### Estado final
- Build: 662.80 KB JS, 36.66 KB CSS, 0 errores
- Componentes: 25 (7 UI components)
- Iconos SVG: 30+ con aria-hidden
- Animaciones: 15 keyframes personalizadas

## 15. Planes futuros sugeridos
- Loop 4: Implementar sticky sidebar con navegacion de secciones
- Code-splitting: Dividir chunks grandes con lazy loading
- Tests: Anadir tests unitarios con Vitest
- i18n: Soporte multi-idioma (espanol/ingles)


---

## 16. Track 1 — Optimizaciones de Rendimiento (Implementado)

### 16.1 Objetivo
Reducir el bundle inicial del frontend mediante code-splitting, lazy loading y memoizaciOn, para que la app cargue mas rapido y consuma menos recursos.

### 16.2 Resultados

| Metrica | Antes | Despues | Mejora |
|---------|-------|---------|--------|
| Bundle inicial | 664 kB | 39.56 kB | 94% menos |
| Chunks totales | 1 (monolitico) | 12 chunks | Lazy loading real |
| recharts (578 kB) | Embebido en bundle inicial | Chunk separado lazy | Carga bajo demanda |
| Componentes lazy | 0 | 7 componentes | HeatMap, RadarChart, HallOfShame, CodeViewer, ScanHistory, TimelineChart, BlameChart |

### 16.3 Cambios realizados

| Archivo | Cambio |
|---------|--------|
| vite.config.js | manualChunks para split de recharts y vendor |
| App.jsx | React.lazy(Dashboard) + Suspense wrapper con fallback LoadingState |
| Dashboard.jsx | React.lazy() para 5 componentes (HeatMap, RadarChart, HallOfShame, CodeViewer, ScanHistory) + LazySection helper |
| GitTabs.jsx | React.lazy() para TimelineChart y BlameChart + LazySection helper |
| SummaryBar.jsx | React.memo() en SummaryBar y MetricBox |
| Badge.jsx | React.memo() en GradeBadge y SeverityBadge |
| StatusPill.jsx | React.memo() en el componente |
| InfoTooltip.jsx | React.memo() en el componente |
| Dashboard.jsx | useMemo() en ExecutiveSummary para sorted array, topViolationLabel, totalViolations, avgScore, totalFiles, gradeColor |

### 16.4 Build
vite v6.4.3 building for production...
671 modules transformed
built in 6.08s
0 errors
dist/assets/index-CB4__G9-.css  37.74 kB (gzip: 7.09 kB)
dist/assets/index-ClV30yHF.js  39.56 kB (gzip: 11.44 kB)

### 16.5 Proximos pasos (Tracks restantes)
1. Track 1: Rendimiento - COMPLETADO
2. Track 2: Accesibilidad - WCAG 2.1 AA, roles, aria-labels, focus management, contraste, skip links
3. Track 3: Mobile PWA - Manifest, service worker, touch gestures, bottom nav, responsive, offline
4. Track 4: Animaciones - Framer Motion, page transitions, micro-interactions, skeleton loaders
5. Track 5: Tests - Vitest + RTL setup, 20+ tests


## 15. Priority Recommendation Engine (Jul 2026)

### 15.1 Overview
New feature that transforms DebtRadar from a passive dashboard into an actionable tool. After a scan completes, a new endpoint computes a priority score per file using the heuristic: `impact = score_gain_possible / estimated_effort_minutes`. Files are ranked by impact ratio (critical > high > medium > low).

### 15.2 Backend

**New file: `backend/analyzer/recommendations.py`**
- `compute_file_priority(file_data) -> dict`: Computes potential score gain (what if all deductions were removed?), estimated effort in minutes (reading time + violation-specific fix time + large file penalty), impact ratio (gain/effort), priority label, top 3 violations, and human-readable reason.
- `compute_all_recommendations(files) -> dict`: Runs priority on all files, sorts by impact ratio descending, returns summary counts (critical/high/medium/low).

**Modified: `backend/api/schemas.py`**
- Added `RecommendationFile`, `RecommendationSummary`, `RecommendationsResponse` Pydantic models.

**Modified: `backend/api/routes.py`**
- Added `GET /api/scan/{job_id}/recommendations` endpoint. Returns sorted recommendations or 404 if job not found/not completed.

**New file: `backend/tests/test_recommendations.py`**
- 5 tests covering: no-violations (low priority), severe (critical), moderate (medium), empty files, sorting by impact ratio.

### 15.3 Frontend

**New file: `frontend/src/components/ActionPlan.jsx`**
- Fetches `/api/scan/{jobId}/recommendations` on mount.
- 4 states: loading (spinner), error (message), empty (null), data (ranked list).
- Each item shows: rank #, priority badge (critical=red, high=orange, medium=yellow), file path (shortened), reason, effort, score gain, current/potential score.
- Clicking a recommendation calls `onSelectFile(filePath)` which opens the CodeViewer modal.
- Staggered entry animations via Framer Motion.
- Wrapped with `React.memo()` for performance.

**Modified: `frontend/src/components/Dashboard.jsx`**
- Added lazy import of ActionPlan via `React.lazy()`.
- Added `handleActionSelectFile` handler that maps file path to file object and opens CodeViewer.
- Rendered after HallOfShame with staggered animation delay.

### 15.4 Build verification
- Frontend: 0 errors, 1074 modules, 6.47s. ActionPlan chunk: 5.58 kB (gzip: 1.86 kB).
- Backend tests: 5/5 passing.
- Frontend tests: 24/24 passing (no regressions).

### 15.5 Plan document
Full implementation plan saved at `docs/superpowers/plans/2026-07-19-priority-recommendation-engine.md` (921 lines, 4 tasks, 17 steps).



## 16. Plan Documents (Jul 2026)

### 16.1 Completed: Priority Recommendation Engine
Plan:  (921 lines)
Status: Implemented. Task 1-4 complete, build verified.

### 16.2 Implemented: All 6 Features (Jul 2026)

**Status: ✅ ALL FEATURES IMPLEMENTED**

The 6 features from the original plan were implemented in a single pass following the recommended execution order. No regressions were introduced.

| # | Feature | Effort | Status | Files Created/Modified |
|---|---------|--------|--------|----------------------|
| 6 | Feedback Loop | Very Low | ✅ Done | `FeedbackWidget.jsx`, `App.jsx` |
| 4 | Focus/Action Mode | Low | ✅ Done | `Dashboard.jsx` |
| 2 | Side-by-Side Scan Diff | Medium | ✅ Done | `scan_diff.py`, `routes.py`, `ScanDiff.jsx`, `test_scan_diff.py` |
| 5 | Offline-first (IndexedDB) | Medium | ✅ Done | `useIndexedDB.js`, `useAnalysis.js` |
| 7 | Portfolio Dashboard | Medium | ✅ Done | `history_db.py`, `routes.py` (/all-projects), `PortfolioDashboard.jsx` |
| 3 | Dependency Graph | High | ✅ Done | `dependency_graph.py`, `schemas.py`, `routes.py`, `DependencyGraph.jsx`, `test_dependency_graph.py` |

#### Build Verification
- **Frontend build**: 0 errors, ~6s (no warnings)
- **Frontend tests**: 163/163 passing across 15 test files
- **Backend modules**: All import correctly (scan_diff, dependency_graph, recommendations)
- **Backend tests**: 5/5 (scan_diff) + 5/5 (dependency_graph)
- **vite.config**: chunkSizeWarningLimit:600 suppresses recharts 578 kB warning (already in manualChunks)

#### Chunk Sizes (lazy-loaded)
| Component | Size (raw) | Size (gzip) |
|-----------|-----------|-------------|
| ScanDiff | 4.88 kB | 1.64 kB |
| DependencyGraph | 5.50 kB | 2.47 kB |
| PortfolioDashboard | 4.09 kB | ~1.4 kB |
| ActionPlan | 5.58 kB | 1.86 kB |

#### Feature Details

**Feature 6 — FeedbackWidget**: 3-button form ("Found new issues", "Already knew", "Not useful") that appears 5s after scan completion. Data persisted in localStorage (`debtradar-feedback`). Dismissable.

**Feature 4 — Focus/Action Mode**: Toggle in Dashboard header. When active, hides HeatMap, RadarChart, ScanHistory, DependencyGraph, and GitTabs — showing only SummaryBar, ExecutiveSummary, HallOfShame, ActionPlan, and skipped files. State persisted in localStorage (`debtradar-focus-mode`).

**Feature 2 — ScanDiff**: Backend computes per-file diffs between two scans (improved/regressed/new/unchanged/removed). Frontend shows color-coded table with score changes and violation deltas. Accessible via `?against=job_id` parameter.

**Feature 5 — Offline-first**: `useIndexedDB` hook wraps IndexedDB with 4 functions: `cacheScanResult`, `getCachedScanResult`, `getAllCachedResults`, `clearCache`. Automatically caches scan results on completion.

**Feature 7 — PortfolioDashboard**: Shows latest scan for every unique project path from SQLite history. Sortable by name, score, or date. Clicking a row navigates to that project's scan.

**Feature 3 — DependencyGraph**: Custom force-directed graph (no d3 dependency) rendered in SVG. Physics simulation (repulsion + attraction + damping + center gravity) runs for 200 iterations. Color-coded by score (green/yellow/orange/red). Hover shows filename, click opens CodeViewer.
