# DebtRadar — Project Description

**Hackathon:** Next Byte Hacks V3  
**Tagline:** *See the invisible. Fix the important. Before it slows you down.*

## Inspiration

Every developer has felt it. You join a project, open a file, and instinctively know something is wrong. The function is 300 lines long. There are six levels of indentation. Numbers like `86400` appear without explanation. TODOs have been accumulating since 2019.

Traditional linters catch missing semicolons and unused variables. But they cannot answer the question that actually matters: **where is my codebase becoming hard to change?**

I built DebtRadar to answer that question — not with guesses, but with data. It is a forensic code health analyzer that scans any Python, JavaScript, or TypeScript repository, builds an AST of every file, and produces a visual, actionable report. All locally. All private. No data ever leaves your machine.

## What it does

DebtRadar measures what most tools miss:

- **Monolithic files** (>800 lines) — files that should be split into modules
- **Cyclomatic complexity** — deeply nested control flow (>7 levels)
- **Over-engineering** — functions with too many branches (>20)
- **Magic numbers** — numeric literals without descriptive names
- **Accumulated TODOs** — documented but unresolved technical debt

The output is a complete interactive dashboard:

| Feature | What it shows |
|---------|--------------|
| **Heat Map** | Treemap of every file: size = lines, color = health grade (A-F) |
| **Debt Radar** | 4-axis radar of complexity, TODOs, magic numbers, and god files |
| **Hall of Shame** | Paginated ranking of worst files with exact violation locations |
| **Code Viewer** | Severity-coded violations with code context and optional AI suggestions |
| **Action Plan** | Files ranked by impact per minute of effort — best ROI first |
| **Dependency Graph** | Interactive force-directed graph color-coded by file health |
| **Scan Comparison** | Side-by-side diff showing what improved or regressed between scans |
| **Portfolio Dashboard** | Multi-project overview for teams managing many repositories |

Beyond the dashboard:
- **Git integration**: historical score across commits + blame attribution per author
- **Exportable reports**: self-contained HTML report and dynamic SVG badge for READMEs
- **File upload**: drag-and-drop analysis of single files
- **CLI mode**: terminal scans with `--output json` for CI/CD pipelines
- **163 automated tests**: every release passes a full test suite

### What it does NOT detect

DebtRadar is honest about its limits. It analyzes structural patterns, not semantics:
1. **AI-generated code** — I detect symptoms of complexity, not their origin. A human at 3am writes the same tangled code as an unsupervised AI.
2. **Runtime bugs** — A 50-line file with a perfect A score can still have a critical bug. Use linters and tests for that.
3. **Security vulnerabilities** — Use specialized tools like Snyk or Bandit for security.

## How I built it

| Layer | Technology |
|-------|-----------|
| **Parser engine** | Tree-sitter (Python, JavaScript, TypeScript, TSX) |
| **Backend** | Python 3.11+, FastAPI, Uvicorn, ProcessPoolExecutor |
| **Frontend** | React 18, Vite, TailwindCSS, Recharts |
| **Real-time** | Server-Sent Events (SSE) for live progress |
| **History** | SQLite for cross-scan comparisons and trends |
| **Deployment** | Docker Compose (one command to run) |

The architecture follows a clean pipeline: a POST request creates a background job, SSE streams real-time progress to a React dashboard, and results render asynchronously with lazy-loaded components. Every file is analyzed in isolation with a 30-second timeout. The entire system runs without external dependencies.

## Challenges I faced

**1. Multi-language AST analysis** — Tree-sitter grammars differ significantly between Python and JavaScript/TypeScript. I built a unified traversal that handles each language's node types while normalizing the output into a single scoring pipeline.

**2. Calibrating a fair scoring system** — The hardest part was tuning deduction values. A 100-line script with one TODO should score B, while a 2,000-line monster with 20 TODOs and nesting depth of 8 should score F. I scanned six reference repositories — from Click and Flask (clean) to Django and TensorFlow (complex) — and adjusted thresholds until the grades matched developer intuition.

**3. Cross-platform security** — When I tested DebtRadar on Windows, I discovered that `C:\Windows\System32` was accepted as a valid scan path. The security checks were completely broken on anything other than Linux. I rewrote the entire path validation system to work correctly on Windows, Mac, and Linux, creating a dedicated cross-platform security module.

**4. Eating my own dogfood** — A code analysis tool must pass its own scrutiny. I audited all 52 frontend files and 31 backend files, finding and fixing 6 bugs: a pathspec mismatch that made .gitignore filtering unreliable on absolute paths, a duplicate scan trigger from Enter key handling, a shallow diff comparison that only checked violation types instead of quantities, and three React lifecycle edge cases (missing animation frame cleanup, impure state updater, and a dangling timeout on unmount). After these fixes, a systematic search found zero similar bugs.

## Accomplishments I am proud of

- A production-ready, local-first, multi-language code health auditor that deploys in one Docker command
- Real-time scan progress via SSE with live percentage, file name, and phase tracking
- 16 interactive dashboard components with lazy loading, animations, and full keyboard accessibility
- Cross-platform support with genuine security protections on all three major operating systems
- 163 passing automated tests — the tool is tested, not just demonstrated
- A complete CI/CD pipeline with GitHub Action, dynamic SVG badges, and CLI mode

## What I learned

- How Tree-sitter ASTs differ between language grammars and how to build language-agnostic analyzers
- That security is platform-specific — testing on one OS does not mean your code is safe everywhere
- How to build a real-time progress system with SSE that handles disconnects, cancellations, and reconnections
- That the most valuable feature of a code analysis tool is not what it finds, but what it tells you to fix first — the Action Plan was the single most requested feature from early testers
- That honesty about limitations builds trust. Every user I showed DebtRadar to appreciated knowing exactly what it does and does not measure.

## What is next

- More language grammars (Go, Rust, Java, C#)
- Nested .gitignore support
- CI/CD integration with automated PR comments
- Code duplication detection
- Performance benchmark suite
- i18n support (English / Spanish)

---

## One-sentence pitch for judges

**DebtRadar is a local-first code health radar that turns the hidden complexity of any Python or JavaScript-family repository into a visual, evidence-backed refactoring priority list — ready to run locally or with Docker in one command.**

---

## Built for Next Byte Hacks V3

All code was written during the hackathon period. The repository includes a full commit history, 163 automated tests, Docker Compose setup, and this live demo. Every judge can run it, see results in seconds, and understand exactly where to look next — because understanding your technical debt should not require technical debt of its own.
