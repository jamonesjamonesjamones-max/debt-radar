# Remaining Features — Implementation Plans

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement these plans task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Complete the remaining 6 feature ideas from the DebtRadar brainstorming session, transforming the app from a passive dashboard into a proactive, collaborative, and intelligent code health platform.

**Architecture:** Each feature is an independent subsystem. They can be implemented in any order. Features 2, 4, and 6 are lowest effort. Features 3 and 5 are medium effort. Feature 7 requires Feature 5 as a prerequisite.

**Tech Stack:** Python 3.11+ / FastAPI (backend), React 18 / TailwindCSS / Framer Motion / Recharts (frontend), SQLite / IndexedDB (storage).

---

## Scope Check

All 6 features are independent subsystems — each produces working, testable software on its own. They are presented as separate plans below. Each plan has its own task structure, file list, test specifications, and commit strategy. They can be executed in any order, though Feature 5 (Offline-first) is a prerequisite for Feature 7 (Portfolio Dashboard).

---

## Feature 2: Side-by-Side Scan Comparison

**Goal:** Allow users to compare two scans and see exactly what changed — which files improved, which regressed, which violations were fixed or introduced.

**Files:**
- Create: \`backend/analyzer/scan_diff.py\`
- Create: \`frontend/src/components/ScanDiff.jsx\`
- Modify: \`backend/api/routes.py\` (add endpoint)
- Modify: \`backend/api/schemas.py\` (add models)
- Modify: \`frontend/src/components/Dashboard.jsx\` (add diff section)
- Test: \`backend/tests/test_scan_diff.py\`
- Test: \`frontend/src/components/ScanDiff.test.jsx\`

**Architecture:** New backend module \`scan_diff.py\` compares two sets of file results (current vs previous). Matches files by path, then computes: score delta, violation deltas (by type), list of new violations, list of resolved violations. Frontend \`ScanDiff\` component renders a summary banner + per-file diff table.

### Task 2.1: Backend - Scan diff engine

- [ ] **Step 1: Create \`backend/analyzer/scan_diff.py\`**

The module has:
- \`compute_file_diff(current_file, previous_file) -> dict\`: Returns score_change, violations_added/removed lists, status (improved/regressed/unchanged/new/removed)
- \`compute_full_diff(current_files, previous_files) -> dict\`: Matches files by path, computes diffs for all files, sorts (regressed first), returns summary with counts

Key logic:
- If file exists in current but not previous -> status = "new"
- If current_score > previous_score -> status = "improved"
- If current_score < previous_score -> status = "regressed"
- Violations are matched by type to determine added/removed

- [ ] **Step 2: Add Pydantic models to \`schemas.py\`**

Models: \`FileDiff\`, \`DiffSummary\`, \`ScanDiffResponse\`

- [ ] **Step 3: Add endpoint to \`routes.py\`**

\`GET /api/scan/{job_id}/diff?against={previous_job_id}\`

Returns the full diff or 404 if either job not found.

- [ ] **Step 4: Write 5 backend tests** in \`backend/tests/test_scan_diff.py\`

### Task 2.2: Frontend - ScanDiff component

- [ ] **Step 1: Create \`ScanDiff.jsx\`** with loading/error/empty/data states
- [ ] **Step 2: Wire into Dashboard.jsx** after ScanHistory section
- [ ] **Step 3: Build and run full test suite**

---

## Feature 3: Code Dependency Graph

**Goal:** Visualize file dependencies as a force-directed graph. Reveals coupling, hub files, and architectural issues.

**Files:**
- Create: \`backend/analyzer/dependency_graph.py\`
- Create: \`frontend/src/components/DependencyGraph.jsx\`
- Modify: \`backend/api/routes.py\`
- Modify: \`frontend/src/components/Dashboard.jsx\`
- Install: \`d3-force\` npm package (~10kB)
- Test: \`backend/tests/test_dependency_graph.py\`

### Task 3.1: Backend - Dependency extraction

- [ ] **Step 1: Create \`dependency_graph.py\`**

Module with:
- \`IMPORT_PATTERNS\`: dict mapping language to regex patterns for import/require statements
  - Python: \`import X\`, \`from X import Y\`
  - JS/TS: \`import X from "Y"\`, \`require("Y")\`
- \`extract_imports(filepath, content) -> list[str]\`
- \`build_dependency_graph(files) -> dict\`: Reads file content from disk, extracts imports, resolves relative paths, returns \`{nodes: [{id, path, lines, score, dependency_count, incoming_dependency_count}], edges: [{source, target}]}\`

- [ ] **Step 2: Add endpoint**: \`GET /api/scan/{job_id}/dependencies\`
- [ ] **Step 3: Write 4 backend tests**

### Task 3.2: Frontend - Force-directed graph

- [ ] **Step 1: Install d3-force**: \`cd frontend && npm install d3-force\`
- [ ] **Step 2: Create \`DependencyGraph.jsx\`** using D3-force simulation + SVG rendering
- [ ] **Step 3: Wire into Dashboard.jsx**

---

## Feature 4: Focus/Action Mode

**Goal:** Streamlined view hiding charts, showing only SummaryBar + ActionPlan + HallOfShame.

**Files:**
- Modify: \`frontend/src/components/Dashboard.jsx\` only

### Task 4.1: Implement Focus Mode

- [ ] **Step 1: Add \`focusMode\` state** with localStorage persistence
- [ ] **Step 2: Add toggle button** ("Action Mode" / "Full View")
- [ ] **Step 3: Wrap non-essential sections** with \`{!focusMode && (...)}\`
- [ ] **Step 4: Build and verify**

---

## Feature 5: Offline-First with IndexedDB Caching

**Goal:** Persist scan results in browser for offline access.

**Files:**
- Create: \`frontend/src/hooks/useIndexedDB.js\`
- Modify: \`frontend/src/hooks/useAnalysis.js\` (save on done)
- Modify: \`frontend/src/App.jsx\` (show cached results)
- Test: \`frontend/src/hooks/useIndexedDB.test.js\`

### Task 5.1: IndexedDB hook

- [ ] **Step 1: Create \`useIndexedDB.js\`** with \`cacheScanResult\`, \`getCachedScanResult\`, \`getAllCachedResults\`, \`clearCache\`
- [ ] **Step 2: Wire into \`useAnalysis.js\`** to save on scan completion
- [ ] **Step 3: Wire into \`App.jsx\`** to show "Recent Scans" on idle
- [ ] **Step 4: Write 2 tests**
- [ ] **Step 5: Build and run tests**

---

## Feature 6: Feedback Loop

**Goal:** Collect anonymous feedback after scan for product narrative.

**Files:**
- Create: \`frontend/src/components/FeedbackWidget.jsx\`
- Modify: \`frontend/src/App.jsx\`
- Test: \`frontend/src/components/FeedbackWidget.test.jsx\`

### Task 6.1: Create FeedbackWidget

- [ ] **Step 1: Create \`FeedbackWidget.jsx\`** with 3 options and localStorage
- [ ] **Step 2: Wire into \`App.jsx\`** with 5s delay after scan
- [ ] **Step 3: Write 2 tests**
- [ ] **Step 4: Build and run tests**

---

## Feature 7: Portfolio / CI Dashboard

**Goal:** Aggregate latest scans for all projects into a single view.

**Prerequisite:** Feature 5 (Offline-first / IndexedDB) or backend endpoint.

**Files:**
- Create: \`backend/utils/history_db.py\` (add \`get_all_latest_scans()\`)
- Create: \`backend/api/routes.py\` (add endpoint)
- Create: \`frontend/src/components/PortfolioDashboard.jsx\`
- Modify: \`frontend/src/App.jsx\`
- Modify: \`frontend/src/components/TopNav.jsx\`
- Test: \`backend/tests/test_portfolio.py\`

### Task 7.1: Backend

- [ ] **Step 1: Add \`get_all_latest_scans()\` to history_db.py**
- [ ] **Step 2: Add endpoint**: \`GET /api/scan/all-projects\`
- [ ] **Step 3: Write 2 backend tests**

### Task 7.2: Frontend

- [ ] **Step 1: Create \`PortfolioDashboard.jsx\`** with sortable table, grade colors
- [ ] **Step 2: Add TopNav button and App.jsx routing**
- [ ] **Step 3: Build and test**

---

## Execution Order (Recommended)

```
Week 1:  Feature 6 (Feedback Loop)     - 1 hour
         Feature 4 (Focus/Action Mode)  - 1 hour
Week 2:  Feature 2 (Scan Comparison)    - 4 hours
         Feature 5 (Offline-first)       - 4 hours
Week 3:  Feature 7 (Portfolio Dashboard) - 3 hours
         Feature 3 (Dependency Graph)    - 6 hours
```

Total estimated effort: ~19 hours across 6 features.
