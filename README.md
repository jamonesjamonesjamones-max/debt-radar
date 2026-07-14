# 📡 DebtRadar

**Auditor forense de salud de código y deuda técnica.**

> Los linters tradicionales te dicen si falta un punto y coma. DebtRadar te dice si tu arquitectura se está pudriendo.

DebtRadar es un auditor forense que analiza repositorios de código fuente de forma estática y local para cuantificar deuda técnica, detectar sobre-ingeniería y alertar sobre patrones de complejidad accidental.

---

## 🎯 ¿Qué es DebtRadar?

DebtRadar construye un árbol sintáctico matemático (AST) de cada archivo y mide la salud arquitectónica de tu repositorio. No es un linter — es un radiólogo de código.

### ✅ Qué Detecta DebtRadar

1. **Archivos monolíticos** (>800 líneas) — archivos que deberían dividirse en módulos
2. **Complejidad ciclomática extrema** (>7 niveles de anidamiento) — código difícil de seguir
3. **Sobre-ingeniería** (funciones con >20 bifurcaciones) — código innecesariamente complejo
4. **Magic numbers** — literales numéricos sin nombre descriptivo
5. **TODOs acumulados** — deuda técnica documentada pero no resuelta
6. **Evolución histórica** — cómo cambia la calidad del código entre commits
7. **Responsabilidad por autor** — quién introdujo cada violación (vía git blame)

### ❌ Qué NO Detecta DebtRadar

1. **NO detecta si el código fue escrito por IA o humano**
   - Detectamos *síntomas* de complejidad, no su *origen*
   - Código complejo puede venir de IA, humanos cansados, deadlines apretados, o falta de code review
   - No tenemos forma de distinguir entre código generado por ChatGPT y código escrito por un humano a las 3am

2. **NO detecta bugs lógicos o errores de runtime**
   - Analizamos *estructura*, no *semántica*
   - Un archivo de 50 líneas con score A puede tener un bug crítico
   - Para bugs, usa linters tradicionales, type checkers y tests

3. **NO detecta problemas de seguridad**
   - No buscamos vulnerabilidades, inyecciones, o dependencias con CVEs
   - Para seguridad, usa herramientas especializadas (Snyk, Bandit, Semgrep)

### 🤔 ¿Por qué "Anti-Bloat" y no "Anti-Vibe-Coding"?

El término "vibe-coding" se asocia con código generado por IA, pero no podemos demostrar que el código fue generado por IA. Lo que sí podemos detectar es el **síntoma**: código innecesariamente complejo, monolítico o inflado.

El problema real es la **complejidad accidental**, sin importar su origen. Un humano bajo presión puede escribir código igual de complejo que una IA sin supervisión. Nuestro enfoque es detectar el síntoma y dejar que el equipo decida la causa.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Backend** | Python 3.11+, FastAPI, Uvicorn |
| **Análisis AST** | Tree-sitter (paquetes precompilados) para Python, JavaScript, TypeScript, TSX |
| **Concurrencia** | `ProcessPoolExecutor` con timeout por archivo |
| **Filtros** | `pathspec` para `.gitignore` |
| **Frontend** | React 18, Vite, TailwindCSS |
| **Gráficos** | Recharts (Treemap, Radar Chart) |
| **Comunicación** | Server-Sent Events (SSE) para progreso en tiempo real |

---

## 📦 Instalación

### Requisitos

- Python 3.11+
- Node.js 18+
- npm o yarn

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

---

## 🐳 Ejecutar toda la aplicación con Docker

Esta es la forma más simple de ejecutar la interfaz y la API de manera reproducible en cualquier equipo con **Docker Desktop** y Docker Compose; no hace falta instalar Python ni Node.js en el host.

1. Desde la raíz del proyecto, crea la configuración local y elige qué carpeta analizar:

   ```powershell
   Copy-Item .env.example .env
   # Edita .env si quieres analizar otra carpeta:
   # SCAN_PATH=C:/Users/you/source/my-project
   ```

   En macOS/Linux, usa `cp .env.example .env`. La carpeta indicada se monta como solo lectura en el contenedor en `/workspace`.

2. Construye e inicia el stack:

   ```bash
   docker compose up --build
   ```

3. Abre `http://localhost:8080` y escribe **`/workspace`** como ruta a analizar. La interfaz es servida por Nginx, que reenvía `/api` y el progreso SSE al backend de forma interna.

4. Para detenerlo cuando termines:

   ```bash
   docker compose down
   ```

La imagen principal `Dockerfile` se conserva para la GitHub Action; el despliegue web usa `backend/Dockerfile`, `frontend/Dockerfile` y `docker-compose.yml`.

---

## 🚀 Uso

### 1. Iniciar el backend

```bash
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 2. Iniciar el frontend

```bash
cd frontend
npm run dev
```

### 3. Abrir la aplicación

Navega a `http://127.0.0.1:5173`

1. Pega la ruta absoluta de tu proyecto en el input (soporta `~`)
2. Ajusta el nivel de paralelismo (1-8 workers)
3. Haz clic en **"Iniciar Escaneo"**
4. Observa el progreso en tiempo real con el cronómetro
5. Explora los resultados en el dashboard interactivo

---

## 📊 Cómo se calcula el Score

Cada archivo comienza con **100 puntos**. Se aplican deducciones:

| Factor | Condición | Deducción |
|--------|-----------|-----------|
| **Archivos Dios** | >1000 líneas | -40 |
| | >500 líneas | -20 |
| **Anidamiento** | >6 niveles | -30 |
| | >4 niveles | -15 |
| **TODOs** | Normalizado por 100 líneas | hasta -20 |
| **Magic Numbers** | Normalizado por 100 líneas | hasta -25 |
| **Funciones complejas** | >15 branches | -25 |
| | >10 branches | -10 |

El score del repositorio es el **promedio ponderado por líneas** de código.

### Grados

| Grado | Score | Significado |
|-------|-------|-------------|
| 🟢 **A** | 90-100 | Código Limpio |
| 🟡 **B** | 75-89 | Deuda Menor |
| 🟠 **C** | 60-74 | Deuda Alta / Alerta Anti-Bloat |
| 🔴 **D** | 40-59 | Código Frágil |
| ⚫ **F** | 0-39 | Peligro Biológico |

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────┐
│           INTERFAZ (React + Vite)                   │
│   Input de Path • Dashboard • Gráficos • Slider     │
│   EventSource (SSE) para progreso en tiempo real    │
└───────────────────┬─────────────────────────────────┘
                    │ HTTP POST + SSE Stream + CORS
┌───────────────────▼─────────────────────────────────┐
│        BACKEND (FastAPI + Pathspec + Uvicorn)       │
│   • POST /api/scan → job_id (BackgroundTasks)       │
│   • GET /api/scan/{job_id}/stream → SSE             │
│   • Filtro de .gitignore (vía pathspec)             │
│   • Poda de directorios ANTES de recorrer           │
└───────────────────┬─────────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────────┐
│  MOTOR DE ANÁLISIS (ProcessPoolExecutor + timeout)  │
│   • safe_process_file() [Aislamiento + timeout 30s] │
│   • Lectura completa de archivo (1 sola vez)        │
│   • RegEx Engine case-sensitive (TODOs)             │
│   • Tree-sitter Parser (AST Iterativo con Stack)    │
│   • Captura de ubicaciones (start_point/end_point)  │
└─────────────────────────────────────────────────────┘
```

---

## 📁 Estructura del Proyecto

```
debt-radar/
├── backend/
│   ├── main.py                    # FastAPI + CORS + entry point
│   ├── api/
│   │   ├── routes.py              # POST /api/scan + SSE stream
│   │   └── schemas.py             # Modelos Pydantic
│   ├── analyzer/
│   │   ├── scanner.py             # Descubrimiento con poda previa
│   │   ├── orchestrator.py        # ProcessPoolExecutor + scoring
│   │   └── metrics.py             # Scoring normalizado + agregación
│   ├── parsers/
│   │   ├── parser_pool.py         # Parsers Tree-sitter (Python/JS/TS/TSX)
│   │   ├── ast_analyzer.py        # Análisis AST iterativo con pila
│   │   └── regex_patterns.py      # Patrones TODO/FIXME
│   ├── mock_data.py               # Datos mock para desarrollo
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx                # Componente raíz
│   │   ├── api/client.js          # Comunicación con backend
│   │   ├── hooks/useAnalysis.js   # Hook SSE + estado
│   │   └── components/
│   │       ├── TopNav.jsx         # Input + slider + botón
│   │       ├── Dashboard.jsx      # Contenedor principal
│   │       ├── SummaryBar.jsx     # Métricas + distribución
│   │       ├── HeatMap.jsx        # Treemap de Recharts
│   │       ├── RadarChart.jsx     # Radar 4 ejes
│   │       ├── HallOfShame.jsx    # Tabla de archivos problemáticos
│   │       ├── CodeViewer.jsx     # Modal con violaciones
│   │       ├── LoadingState.jsx   # Progreso + cronómetro
│   │       └── EmptyStates.jsx    # Estados vacíos
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── index.html
└── README.md
```

---

## ⚠️ Limitaciones Conocidas

- **Lenguajes**: Solo Python, JavaScript, TypeScript y TSX
- **Single root `.gitignore`**: No soporta `.gitignore` anidados en subdirectorios
- **Límite de archivos**: Máximo 5000 por escaneo
- **Límite de tamaño**: Archivos >1MB son omitidos
- **Análisis estático**: No detecta runtime issues, solo patrones estructurales
- **Scoring calibrado**: Los umbrales pueden necesitar ajuste según el ecosistema del proyecto

---

## 🔮 Roadmap

- [ ] Soporte para más lenguajes (Go, Rust, Java)
- [ ] `.gitignore` anidados
- [ ] Export de reportes (PDF, JSON)
- [ ] Comparación entre escaneos (historial)
- [ ] Integración con CI/CD
- [ ] Detección de duplicación de código

---

## 📄 Licencia

MIT
