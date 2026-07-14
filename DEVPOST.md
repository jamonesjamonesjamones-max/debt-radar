# DebtRadar — Project Description

**Hackathon:** Next Byte Hacks V3  
**Tagline:** *Make invisible technical debt visible before it slows down the next idea.*

## Inspiration

Shipping software fast is easier than keeping its architecture healthy. Teams can see broken builds and syntax errors, but accidental complexity often grows quietly: one oversized file, deeply nested control flow, an expanding pile of TODOs, or unexplained numbers copied throughout the codebase. Traditional linters are excellent at style rules, yet they do not give developers a clear, visual answer to a broader question: **where is our codebase becoming hard to change?**

We built DebtRadar to make that answer immediate, local, and actionable. It is a code-health dashboard that scans a repository, ranks the files that need attention, and explains the structural signals behind the score.

## What it does

DebtRadar is a local technical-debt analyzer for Python, JavaScript, TypeScript, JSX, and TSX projects. A developer enters a repository path, chooses how many CPU workers to use, and receives a live progress stream followed by an interactive dashboard.

The scan:

- Respects `.gitignore` and skips dependencies, hidden folders, generated/minified files, oversized files, symbolic links, and sensitive files such as `.env` or private-key formats.
- Parses source files with Tree-sitter ASTs instead of relying only on text matching.
- Identifies structural debt signals: oversized files, excessive nesting, complex functions, suspicious magic numbers, and accumulated TODO/FIXME comments.
- Assigns each file a deterministic 0–100 score and an A–F grade. Repository scores are weighted by lines of code, so a tiny utility does not outweigh a large module.
- Streams scan progress through Server-Sent Events (SSE), so users can see elapsed time and the file currently being analyzed.

The dashboard turns results into a quick investigation workflow:

- **Heat Map:** file size is area and health score is color, making large risky files stand out.
- **Debt Radar:** an at-a-glance view of the repository’s debt profile.
- **Hall of Shame:** a paginated ranking of the lowest-scoring files, including readable contextual paths and the complete original path for long folder structures.
- **Code Viewer:** exact violation locations, severity, context, and optional local Ollama refactor suggestions.
- **Git insights:** historical score evolution and Git blame attribution when the scanned folder is a Git repository.
- **Sharing:** a generated badge and a self-contained HTML report.

## How we built it

DebtRadar has a React 18 + Vite + TailwindCSS frontend and a Python FastAPI backend. React manages the guided onboarding, scan state, result visualizations, keyboard-accessible interactions, and error recovery. Recharts powers the treemap, radar, history, and blame charts.

FastAPI creates in-memory scan jobs and exposes a REST API plus an SSE progress endpoint. The backend discovers files safely, then uses `ProcessPoolExecutor` to analyze them in parallel. Each worker preloads the Tree-sitter parsers, avoiding parser startup cost for every file. The scoring engine centralizes all deductions and aggregates a lines-of-code-weighted repository grade.

The project is also packaged as a reproducible Docker stack. Nginx serves the built frontend and proxies same-origin `/api` and SSE requests to FastAPI. The scanned host folder is mounted read-only as `/workspace`; scan history is persisted in a dedicated Docker volume. This lets a new user run the full app with Docker Compose without installing Python or Node.js.

## Built with

- Python, FastAPI, Uvicorn, Tree-sitter, pathspec, Typer, Rich, SQLite
- React, Vite, TailwindCSS, Recharts, EventSource/SSE
- Docker Compose, Nginx
- Git and optional Ollama for fully local AI refactor suggestions

## Challenges we ran into

**Measuring meaningful nesting.** Raw AST depth is misleading because syntax trees include many structural nodes that developers do not experience as control-flow complexity. We refined the metric to count relevant branching and control-flow constructs rather than every AST level.

**Different Tree-sitter language APIs.** Python, JavaScript, TypeScript, and TSX grammar packages do not expose identical APIs. We built a parser pool that handles each grammar explicitly and initializes it once per worker.

**Large-repository UX.** Rendering thousands of table rows or SVG rectangles can freeze a browser exactly when the scan finishes. DebtRadar now pages the problem-file table and limits the treemap to the largest relevant files, while preserving the complete analysis results and making full long paths available.

**Reliable completion over SSE.** We found and removed a race in which the backend could mark a job completed before summary aggregation finished. Jobs now have an intermediate aggregation state, and the frontend receives completed results only after their summary is ready.

**Cross-platform path safety.** Windows and Unix use different path separators and system directories. A shared path-security module now blocks sensitive operating-system directories in both the API and CLI, and path-display helpers work with either separator.

## Accomplishments that we are proud of

- Created a useful end-to-end developer tool rather than a static concept: choose a repository, watch it scan, inspect precise results, and export a report.
- Kept code analysis local by default. Source code is analyzed on the user’s machine or in their local Docker environment; Ollama integration is optional and local.
- Combined static analysis, visual prioritization, Git context, scan history, CLI output, badges, and HTML export in one focused workflow.
- Made the product approachable for first-time users with onboarding, clear empty/error states, keyboard support, responsive controls, and human-readable long paths.
- Validated the Docker deployment locally: images build successfully, frontend and backend healthchecks pass, Nginx proxies the API and SSE stream, and a real `/workspace` scan completes.

## What we learned

We learned that the quality of a developer tool depends as much on trust and clarity as on the metric itself. A score without evidence is not useful, so DebtRadar connects every score to files, exact lines, and visual context. We also learned that a feature is only truly useful if it works across environments: normalizing paths, protecting sensitive folders, handling large result sets, and shipping a reproducible Docker setup all mattered as much as the AST logic.

## What is next for DebtRadar

- Add more language grammars, including Go, Rust, Java, and C#.
- Support nested `.gitignore` files and configurable organization-specific rules.
- Add CI annotations and pull-request comparisons.
- Improve result filtering, folder-level rollups, and trend alerts.
- Add test coverage and benchmark suites for larger repositories.
- Offer optional team-shared scan history while keeping the local-first mode intact.

## Privacy and limitations

DebtRadar detects structural indicators of technical debt; it does **not** prove whether code was written by a human or AI, diagnose runtime bugs, or replace dedicated security scanners. It is designed to prioritize investigation, not to make architectural decisions automatically.

The default workflow is local-first. Docker mounts the selected project directory read-only, and the optional Ollama feature communicates only with a locally running Ollama service. Users should still avoid scanning repositories they are not authorized to inspect.

## Demo walkthrough (1–3 minutes)

1. Start the Docker stack with `docker compose up --build` and open `http://localhost:8080`.
2. Enter `/workspace`, choose workers, and start a scan. Show live SSE progress and the current file.
3. Open the Heat Map and point out a large red/orange file; hover to show its complete path.
4. Open the same file in the Hall of Shame and show its score, visible full path, and detected violations.
5. Open Code Viewer to show the exact location and context behind a finding.
6. Show the HTML export, badge, and—if scanning a Git repository—the History or Blame tab.
7. Close with: **“DebtRadar turns invisible complexity into a prioritized, local-first action list.”**

## Submission links

- **Source code:** _Add the public GitHub repository URL after publishing._
- **Demo video:** _Add the 1–3 minute video URL._
- **Screenshots:** _Add at least 2–3 screenshots: onboarding/scan progress, dashboard, and file details._

## Why DebtRadar is a strong fit for Next Byte Hacks V3

### Clear problem, practical impact

DebtRadar addresses a real problem faced by every software team: code can remain “working” while becoming progressively harder to understand and change. The project converts that invisible cost into a prioritized visual report. Its output is actionable in minutes: identify the worst file, open the exact issue, and decide what to refactor first.

### Innovation and creativity

The project is not another syntax checker or AI chatbot. Its central idea is a **technical-debt radar**: combine AST-based structural signals, a weighted health score, visual risk mapping, history, authorship context, and evidence-level code details in one local-first workflow. The result does not pretend to know whether code was written by AI; it measures observable complexity symptoms instead. That makes the product useful in the current era of rapid and AI-assisted development without making unsupported claims.

### Technical execution

The demo proves a complete working pipeline rather than a mockup: safe file discovery → Tree-sitter parsing → parallel analysis → deterministic scoring → SSE progress → interactive visual dashboard → report export. The implementation includes safeguards for sensitive paths, secrets, generated files, large repositories, cancellation, incomplete SSE results, long Windows paths, and Docker deployment. Optional Ollama suggestions are local and do not make the core analyzer dependent on an external AI service.

### User experience and demo clarity

The first-run onboarding explains what to scan, the progress screen shows that the app is working, and the dashboard answers the most important next question: “Where should I look first?” The Heat Map gives a fast visual overview; the ranked table provides prioritization; and Code Viewer supplies evidence. Long paths remain identifiable even in deeply nested Windows folders, so a judge can understand exactly which module is affected.

### Completeness and reproducibility

The submission includes source code, setup instructions, a CLI, a Docker Compose deployment, a live API stream, an HTML export, a badge, and optional Git/Ollama integrations. A judge can run the project with Docker instead of reconstructing a development environment:

```bash
cp .env.example .env
# Set SCAN_PATH to a local project folder if desired
docker compose up --build
```

Then open `http://localhost:8080` and scan `/workspace`.

## Submission checklist for Devpost

- **Project Description:** Use the sections above and keep the first paragraph focused on the problem and impact.
- **Demo video (1–3 minutes):** Show one complete scan, not a slide presentation. Include progress, Heat Map, Hall of Shame, a long path, Code Viewer, and one export or Git feature.
- **Public GitHub repository:** Publish the source with `README.md`, `DEVPOST.md`, Docker instructions, and no credentials or local environments.
- **Screenshots:** Upload at least three images: onboarding/scan progress, finished dashboard, and Code Viewer with a real finding.
- **Tools used:** List Python/FastAPI, Tree-sitter, React/Vite, Recharts, Docker/Nginx, and optional Ollama clearly.
- **Challenges and learning:** Keep the Tree-sitter, large-repository, SSE race, cross-platform path, and Docker lessons visible; they demonstrate engineering depth.
- **Future plans:** Mention language expansion, CI annotations, folder rollups, nested `.gitignore` support, and trend alerts.

## Judge-facing one-sentence pitch

**DebtRadar is a local-first code-health radar that turns the hidden complexity of any Python or JavaScript-family repository into a visual, evidence-backed refactoring priority list—ready to run locally or with Docker.**
