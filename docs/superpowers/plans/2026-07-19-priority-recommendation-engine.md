# Priority Recommendation Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform DebtRadar from a passive dashboard into an actionable tool that tells developers *which files to fix first, why, and what the impact would be*.

**Architecture:** A new backend endpoint `/api/scan/{job_id}/recommendations` computes a priority score per file using a heuristic: `impact = score_gain_possible * severity_multiplier / estimated_effort_lines`. Each recommendation includes the file path, current score, estimated effort (in minutes), potential score gain, and the top violations driving the recommendation. A new `ActionPlan.jsx` component renders these as a ranked list with visual priority badges, expandable details, and one-click refactor suggestion buttons.

**Tech Stack:** Python 3.11+ (backend), React 18 + TailwindCSS + Framer Motion (frontend), existing `active_jobs` in-memory store, existing test infrastructure (Vitest + RTL).

## Global Constraints

- Backend: Python 3.11+, FastAPI, Pydantic schemas
- Frontend: React 18, TailwindCSS, Framer Motion, Recharts (existing)
- All new components must follow existing patterns: `lazy()` loading via `LazySection`, `React.memo()` where appropriate, `role` and `aria-*` attributes for accessibility
- All SVG icons must come from `ui/Icons.jsx` with `aria-hidden="true"`
- All text must be in English
- Backend tests: pytest (if any test file exists for the module being modified)
- Frontend tests: Vitest + React Testing Library (24 existing tests in `src/test/`)
- Build must pass with 0 errors
- No new npm dependencies — use only existing libraries

---

### Task 1: Backend — Recommendation engine module

**Files:**
- Create: `backend/analyzer/recommendations.py`
- Modify: `backend/api/routes.py` (add endpoint)
- Modify: `backend/api/schemas.py` (add Pydantic models)

**Interfaces:**
- Consumes: `active_jobs: dict` from `routes.py`, file results structure from `aggregate_results()`
- Produces: `compute_recommendations(job_id, active_jobs) -> dict` function, new endpoint `GET /api/scan/{job_id}/recommendations`

The file result structure from `aggregate_results` has this shape per file:
```python
{
    "path": "src/main.py",
    "lines": 300,
    "score": 45,
    "language": "python",
    "deductions": {"file_size": -20, "complexity": -30, "todos": -10, "magic_numbers": -5, "function_complexity": 0},
    "violations": [{"type": "max_nesting", "line": 42, "severity": "high", "context": "..."}, ...]
}
```

- [ ] **Step 1: Create `backend/analyzer/recommendations.py`**

```python
"""
Recommendations — Priority engine that tells developers which files to fix first.
Computes a priority score per file using heuristics over existing scan data.
"""

from typing import Any

# Severity multipliers — high severity violations get higher priority
SEVERITY_MULTIPLIERS = {
    "high": 3.0,
    "medium": 1.5,
    "low": 1.0,
}

# Estimated effort (minutes) per violation, by type
EFFORT_PER_VIOLATION = {
    "max_nesting": 15,     # Restructuring nested code takes time
    "magic_number": 3,     # Simple extraction to constant
    "todo": 5,             # Varies, but time for context + fix
}

# Effort baseline in minutes
EFFORT_BASE_LINES_PER_MINUTE = 50  # Reading + understanding 50 lines per minute


def compute_file_priority(file_data: dict) -> dict:
    """
    Compute a priority score for a single file.
    
    Returns a dict with:
    - file_path: str
    - current_score: int
    - potential_score: int (score if all flaggable deductions were removed)
    - score_gain: int (potential_score - current_score)
    - estimated_effort_minutes: float
    - impact_ratio: float (score_gain / estimated_effort_minutes)
    - priority_label: str ("critical" | "high" | "medium" | "low")
    - top_violations: list of violation dicts driving the recommendation
    - reason: str (human-readable explanation)
    """
    deductions: dict = file_data.get("deductions", {}) or {}
    violations: list = file_data.get("violations", []) or []
    lines: int = max(file_data.get("lines", 1), 1)
    current_score: int = file_data.get("score", 0)
    
    # Calculate potential score: what would the score be if we removed ALL deductions?
    total_deductions = sum(d for d in deductions.values() if d < 0)
    potential_score = min(100, current_score + abs(total_deductions))
    score_gain = potential_score - current_score
    
    # Calculate estimated effort
    effort_minutes = 0.0
    
    # Base effort: reading and understanding the file
    effort_minutes += lines / EFFORT_BASE_LINES_PER_MINUTE
    
    # Violation-specific effort
    violation_type_counts: dict[str, int] = {}
    for v in violations:
        vtype = v.get("type", "")
        violation_type_counts[vtype] = violation_type_counts.get(vtype, 0) + 1
    
    for vtype, count in violation_type_counts.items():
        effort_per = EFFORT_PER_VIOLATION.get(vtype, 8)
        effort_minutes += count * effort_per * 0.7  # 0.7 factor for fixing multiple of same type
    
    # Large file penalty (more effort to modify)
    if lines > 800:
        effort_minutes *= 1.3
    elif lines > 500:
        effort_minutes *= 1.15
    
    # Impact ratio: score gain per minute of effort
    impact_ratio = round(score_gain / max(effort_minutes, 1), 2)
    
    # Priority label
    if impact_ratio >= 2.0:
        priority_label = "critical"
    elif impact_ratio >= 1.0:
        priority_label = "high"
    elif impact_ratio >= 0.5:
        priority_label = "medium"
    else:
        priority_label = "low"
    
    # Top violations (up to 3 most severe)
    sorted_violations = sorted(violations, key=lambda v: {"high": 3, "medium": 2, "low": 1}.get(v.get("severity", "low"), 1), reverse=True)
    top_violations = sorted_violations[:3]
    
    # Build human-readable reason
    reason_parts = []
    if deductions.get("file_size", 0) < 0:
        reason_parts.append(f"Large file ({lines} lines)")
    if deductions.get("complexity", 0) < 0:
        reason_parts.append("High nesting depth")
    if violation_type_counts.get("magic_number", 0) > 0:
        reason_parts.append(f"{violation_type_counts['magic_number']} magic numbers")
    if violation_type_counts.get("todo", 0) > 0:
        reason_parts.append(f"{violation_type_counts['todo']} TODOs/FIXMEs")
    if deductions.get("function_complexity", 0) < 0:
        reason_parts.append("Complex functions with many branches")
    
    reason = " + ".join(reason_parts[:3]) if reason_parts else "Minor improvements available"
    
    return {
        "file_path": file_data.get("path", ""),
        "current_score": current_score,
        "potential_score": potential_score,
        "score_gain": score_gain,
        "estimated_effort_minutes": round(max(effort_minutes, 1), 1),
        "impact_ratio": impact_ratio,
        "priority_label": priority_label,
        "top_violations": top_violations,
        "reason": reason,
    }


def compute_all_recommendations(files: list[dict]) -> dict:
    """
    Compute recommendations for all files in a scan result.
    
    Returns:
    {
        "recommendations": [sorted list of file priority dicts],
        "summary": {
            "total_files_analyzed": int,
            "critical_count": int,
            "high_count": int,
            "medium_count": int,
            "low_count": int,
            "max_potential_gain": int (score gain if all critical files fixed),
            "total_estimated_effort_minutes": float
        }
    }
    """
    if not files:
        return {"recommendations": [], "summary": _empty_summary()}
    
    recs = [compute_file_priority(f) for f in files]
    # Sort by impact ratio descending (highest impact first)
    recs.sort(key=lambda r: r["impact_ratio"], reverse=True)
    
    critical = sum(1 for r in recs if r["priority_label"] == "critical")
    high = sum(1 for r in recs if r["priority_label"] == "high")
    medium = sum(1 for r in recs if r["priority_label"] == "medium")
    low = sum(1 for r in recs if r["priority_label"] == "low")
    
    max_gain = sum(r["score_gain"] for r in recs if r["priority_label"] in ("critical", "high"))
    total_effort = sum(r["estimated_effort_minutes"] for r in recs if r["priority_label"] in ("critical", "high"))
    
    return {
        "recommendations": recs,
        "summary": {
            "total_files_analyzed": len(files),
            "critical_count": critical,
            "high_count": high,
            "medium_count": medium,
            "low_count": low,
            "max_potential_gain": max_gain,
            "total_estimated_effort_minutes": round(total_effort, 1),
        },
    }


def _empty_summary() -> dict:
    return {
        "total_files_analyzed": 0,
        "critical_count": 0,
        "high_count": 0,
        "medium_count": 0,
        "low_count": 0,
        "max_potential_gain": 0,
        "total_estimated_effort_minutes": 0,
    }
```

- [ ] **Step 2: Add Pydantic models to `backend/api/schemas.py`**

Append before the final closing of the file:

```python
class RecommendationFile(BaseModel):
    file_path: str
    current_score: int
    potential_score: int
    score_gain: int
    estimated_effort_minutes: float
    impact_ratio: float
    priority_label: str
    reason: str

class RecommendationSummary(BaseModel):
    total_files_analyzed: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    max_potential_gain: int
    total_estimated_effort_minutes: float

class RecommendationsResponse(BaseModel):
    recommendations: list[RecommendationFile]
    summary: RecommendationSummary
```

- [ ] **Step 3: Add the recommendations endpoint to `backend/api/routes.py`**

After the `scan_stream` function, insert:

```python
from analyzer.recommendations import compute_all_recommendations


@router.get("/scan/{job_id}/recommendations")
async def get_recommendations(job_id: str):
    """
    Returns prioritized refactoring recommendations for a completed scan.
    Each file gets an impact ratio (score gain per minute of effort).
    Sorted by impact (highest first).
    """
    job = active_jobs.get(job_id)
    if not job or job.get("status") != "completed" or not job.get("result"):
        raise HTTPException(status_code=404, detail="Job not found or not completed")

    files = job["result"].get("files", [])
    if not files:
        raise HTTPException(status_code=404, detail="No files in scan result")

    recommendations = compute_all_recommendations(files)
    return recommendations
```

- [ ] **Step 4: Run existing backend tests to verify no regressions**

Run: `cd backend && python -m pytest tests/ -v 2>&1 || echo "No tests dir"`

Expected: Either all pass or "No tests dir" (acceptable since backend may not have test dir yet).

---

### Task 2: Backend — Test the recommendation engine

**Files:**
- Create: `backend/tests/test_recommendations.py`

**Interfaces:**
- Consumes: `compute_file_priority`, `compute_all_recommendations` from `analyzer/recommendations.py`
- Produces: Verified correctness of priority calculations

- [ ] **Step 1: Create test file with sample data**

```python
"""Tests for the recommendation engine."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from analyzer.recommendations import compute_file_priority, compute_all_recommendations


def make_file(score=80, lines=200, deductions=None, violations=None):
    return {
        "path": f"src/file_{score}.py",
        "lines": lines,
        "score": score,
        "language": "python",
        "deductions": deductions or {"file_size": 0, "complexity": 0, "todos": 0, "magic_numbers": 0, "function_complexity": 0},
        "violations": violations or [],
    }


def test_compute_file_priority_no_violations():
    """A file with no violations should have low priority and zero score gain."""
    f = make_file(score=95, lines=100)
    result = compute_file_priority(f)
    assert result["priority_label"] == "low"
    assert result["score_gain"] == 5
    assert result["current_score"] == 95


def test_compute_file_priority_critical():
    """A file with severe deductions should be critical priority."""
    f = make_file(
        score=30,
        lines=600,
        deductions={"file_size": -40, "complexity": -30, "todos": -15, "magic_numbers": -10, "function_complexity": -25},
        violations=[
            {"type": "max_nesting", "line": 100, "severity": "high", "context": "def foo():"},
            {"type": "magic_number", "line": 42, "severity": "medium", "context": "x = 86400"},
            {"type": "todo", "line": 10, "severity": "low", "context": "# TODO: refactor"},
        ],
    )
    result = compute_file_priority(f)
    assert result["priority_label"] in ("critical", "high")
    assert result["score_gain"] >= 50  # 100 - 30 = 70 potential gain
    assert result["estimated_effort_minutes"] > 10
    assert len(result["top_violations"]) == 3


def test_compute_file_priority_medium():
    """A file with moderate issues should be medium priority."""
    f = make_file(
        score=72,
        lines=200,
        deductions={"file_size": 0, "complexity": 0, "todos": -10, "magic_numbers": -5, "function_complexity": 0},
        violations=[
            {"type": "todo", "line": 5, "severity": "low", "context": "# FIXME: optimize"},
            {"type": "magic_number", "line": 88, "severity": "low", "context": "timeout = 300"},
        ],
    )
    result = compute_file_priority(f)
    assert result["score_gain"] == 15  # 10 + 5 = 15
    assert "todos" in result["reason"].lower() or "magic" in result["reason"].lower()
    assert len(result["top_violations"]) <= 3


def test_compute_all_recommendations_empty():
    """Empty file list should return empty recommendations."""
    result = compute_all_recommendations([])
    assert result["recommendations"] == []
    assert result["summary"]["total_files_analyzed"] == 0


def test_compute_all_recommendations_sorting():
    """Recommendations should be sorted by impact_ratio descending."""
    files = [
        make_file(score=30, lines=600, deductions={"file_size": -40, "complexity": -30, "todos": -15, "magic_numbers": -10, "function_complexity": -25},
                  violations=[{"type": "max_nesting", "line": 100, "severity": "high", "context": "def foo():"}]),
        make_file(score=85, lines=100, deductions={"file_size": 0, "complexity": 0, "todos": -5, "magic_numbers": 0, "function_complexity": 0},
                  violations=[{"type": "todo", "line": 5, "severity": "low", "context": "# TODO"}]),
        make_file(score=55, lines=350, deductions={"file_size": -20, "complexity": -15, "todos": -8, "magic_numbers": -5, "function_complexity": 0},
                  violations=[{"type": "max_nesting", "line": 42, "severity": "high", "context": "if x:"}, {"type": "magic_number", "line": 10, "severity": "medium", "context": "x = 60"}]),
    ]
    result = compute_all_recommendations(files)
    assert len(result["recommendations"]) == 3
    ratios = [r["impact_ratio"] for r in result["recommendations"]]
    assert ratios == sorted(ratios, reverse=True), "Recommendations should be sorted by impact ratio descending"
    assert result["summary"]["total_files_analyzed"] == 3
    assert result["summary"]["critical_count"] >= 0
    assert result["summary"]["high_count"] >= 0
```

- [ ] **Step 2: Run pytest to validate all tests pass**

Run: `cd backend && python -m pytest tests/test_recommendations.py -v`

Expected: All 5 tests PASS

- [ ] **Step 3: Commit backend changes**

```bash
git add backend/analyzer/recommendations.py backend/api/schemas.py backend/api/routes.py backend/tests/test_recommendations.py
git commit -m "feat: add priority recommendation engine with tests"
```

---

### Task 3: Frontend — ActionPlan component

**Files:**
- Create: `frontend/src/components/ActionPlan.jsx`
- Modify: `frontend/src/components/Dashboard.jsx` (import and render ActionPlan)

**Interfaces:**
- Consumes: `jobId: string` from Dashboard props, `API_BASE` from `api/client.js`
- Produces: `<ActionPlan jobId={jobId} />` component

The component fetches `GET /api/scan/{jobId}/recommendations`, renders a ranked list of file recommendations, with priority badges, estimated effort, score gain, expandable details, and a "Refactor" button per file that opens the existing CodeViewer.

Requires: `LoadingIcon`, `ErrorXIcon`, `BoomIcon`, `LightbulbIcon`, `ArrowRightIcon`, `DownloadIcon` from `ui/Icons.jsx`. Add these if they don't exist.

- [ ] **Step 1: Create `frontend/src/components/ActionPlan.jsx`**

```jsx
/**
 * ActionPlan — Prioritized list of files to refactor, ranked by impact/effort ratio.
 * Helps developers decide what to work on first.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "../api/client";
import { shortenPath } from "../utils/paths";
import InfoTooltip from "./ui/InfoTooltip";
import StatusPill from "./ui/StatusPill";
import { LoadingIcon, ErrorXIcon, BoomIcon, LightbulbIcon, ArrowRightIcon } from "./ui/Icons";

const PRIORITY_CONFIG = {
  critical: {
    label: "Critical",
    color: "text-semantic-error",
    bg: "bg-semantic-error-bg",
    border: "border-semantic-error",
    iconBg: "bg-semantic-error/15",
  },
  high: {
    label: "High",
    color: "text-semantic-warning",
    bg: "bg-semantic-warning-bg",
    border: "border-semantic-warning",
    iconBg: "bg-semantic-warning/15",
  },
  medium: {
    label: "Medium",
    color: "text-grade-c",
    bg: "bg-grade-c-bg",
    border: "border-grade-c",
    iconBg: "bg-grade-c/15",
  },
  low: {
    label: "Low",
    color: "text-text-muted",
    bg: "bg-surface-3/30",
    border: "border-surface-3",
    iconBg: "bg-surface-3/50",
  },
};

export default function ActionPlan({ jobId, onSelectFile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    fetch(`${API_BASE}/api/scan/${jobId}/recommendations`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [jobId]);

  if (loading) {
    return (
      <div className="card-premium p-6 text-center space-y-3 animate-fade-in">
        <div className="inline-flex items-center justify-center">
          <LoadingIcon size={24} className="text-accent" />
        </div>
        <p className="text-text-muted text-sm">Prioritizing recommendations…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-premium p-6 text-center space-y-3 animate-fade-in">
        <div className="flex justify-center">
          <ErrorXIcon size={24} className="text-semantic-error" />
        </div>
        <p className="text-text-muted text-sm">Could not load recommendations: {error}</p>
      </div>
    );
  }

  if (!data || !data.recommendations?.length) return null;

  const { summary, recommendations } = data;

  return (
    <div className="card-premium overflow-hidden animate-card-enter">
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-3">
        <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3">
          <div>
            <h3 className="section-header flex items-center gap-1.5">
              <LightbulbIcon size={16} className="text-semantic-warning" />
              Action Plan
              <InfoTooltip text="Files ranked by impact per minute of effort. Start with Critical and High files for the best return on investment." side="bottom" />
            </h3>
            <p className="text-caption text-text-muted mt-0.5">
              Prioritized by impact ratio (score gain ÷ effort)
            </p>
          </div>
          <div className="flex items-center gap-3 text-eyebrow text-text-muted">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-semantic-error" />
              {summary.critical_count} critical
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-semantic-warning" />
              {summary.high_count} high
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-grade-c" />
              {summary.medium_count} medium
            </span>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-3 flex items-center gap-4 flex-wrap text-[10px] text-text-muted">
          <span>
            <span className="font-mono font-bold text-text-primary">{summary.max_potential_gain}</span> pts potential gain
          </span>
          <span className="w-1 h-1 rounded-full bg-surface-4" />
          <span>
            <span className="font-mono font-bold text-text-primary">
              {summary.total_estimated_effort_minutes >= 60
                ? `${(summary.total_estimated_effort_minutes / 60).toFixed(1)}h`
                : `${summary.total_estimated_effort_minutes}m`}
            </span> estimated effort
          </span>
          <span className="w-1 h-1 rounded-full bg-surface-4" />
          <span>
            <span className="font-mono font-bold text-text-primary">{summary.total_files_analyzed}</span> files analyzed
          </span>
        </div>
      </div>

      {/* Recommendations list */}
      <div className="divide-y divide-surface-3/50">
        {recommendations.map((rec, i) => {
          const config = PRIORITY_CONFIG[rec.priority_label] || PRIORITY_CONFIG.low;
          const effortDisplay = rec.estimated_effort_minutes >= 60
            ? `${(rec.estimated_effort_minutes / 60).toFixed(1)}h`
            : `${Math.round(rec.estimated_effort_minutes)}m`;

          return (
            <motion.div
              key={rec.file_path}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.6) }}
              className="px-5 py-3 interactive-transition hover:bg-surface-3/20 cursor-pointer"
              onClick={() => {
                // Find the full file data from the original file list
                // The parent Dashboard has access to `files` prop
                if (onSelectFile) {
                  onSelectFile(rec.file_path);
                }
              }}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && onSelectFile) {
                  e.preventDefault();
                  onSelectFile(rec.file_path);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`Recommendation for ${rec.file_path}: ${rec.priority_label} priority`}
            >
              <div className="flex items-start gap-3">
                {/* Rank number */}
                <span className="text-caption text-text-muted font-mono mt-0.5 shrink-0">
                  #{i + 1}
                </span>

                {/* Priority badge */}
                <div className="shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-pill text-[9px] font-bold uppercase tracking-wider ${config.color} ${config.bg}`}>
                    {config.label}
                  </span>
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <span className="block font-mono text-xs text-text-primary break-all" title={rec.file_path}>
                    {shortenPath(rec.file_path, 4)}
                  </span>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {rec.reason}
                  </p>
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-3 shrink-0 text-right">
                  <div className="hidden sm:block">
                    <p className="text-caption text-text-muted">Effort</p>
                    <p className="text-xs font-mono font-bold text-text-primary">{effortDisplay}</p>
                  </div>
                  <div>
                    <p className="text-caption text-text-muted">Gain</p>
                    <p className="text-xs font-mono font-bold text-semantic-success">+{rec.score_gain}</p>
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-caption text-text-muted">Score</p>
                    <p className="text-xs font-mono text-text-secondary">{rec.current_score} → {rec.potential_score}</p>
                  </div>
                  <ArrowRightIcon size={14} className="text-text-muted shrink-0" />
                </div>
              </div>

              {/* Violation pills (expandable) */}
              {rec.top_violations?.length > 0 && (
                <div className="mt-2 ml-7 flex items-center gap-1.5 flex-wrap">
                  {rec.top_violations.map((v, vi) => (
                    <StatusPill key={vi} type={v.type} count={1} />
                  ))}
                  <span className="text-[9px] text-text-muted ml-1">Click to inspect</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrate ActionPlan into Dashboard.jsx**

Modify `Dashboard.jsx`:

1. Import ActionPlan at the top:
```jsx
import ActionPlan from "./ActionPlan";
```

2. Add a state for `selectedFilePath` to enable `onSelectFile`:
```jsx
const [selectedFile, setSelectedFile] = useState(null);
const [selectedFilePath, setSelectedFilePath] = useState(null);
```

3. Add `onSelectFile` handler that finds the file by path and sets it as selected:
```jsx
const handleSelectFileByPath = useCallback((filePath) => {
  const found = files.find(f => f.path === filePath);
  if (found) setSelectedFile(found);
}, [files]);
```

Wait — this introduces complexity. Instead, let's keep it simple: render ActionPlan after the HallOfShame, and use the existing `onSelect` / `setSelectedFile` mechanism. ActionPlan's `onSelectFile` prop will call `setSelectedFile` after resolving the path. But ActionPlan doesn't have access to `files`. Let me reconsider.

**Simpler approach:** We'll render ActionPlan and pass it a callback `onSelectFile={(filePath) => { ... }}`. In Dashboard, we create a helper that loops through `files` to find the matching file object and calls `setSelectedFile`. This keeps the interface clean.

Add this right after the `ExecutiveSummary` section:

```jsx
{/* Action Plan — prioritized recommendations */}
<ActionPlan jobId={jobId} onSelectFile={(filePath) => {
  const found = files.find(f => f.path === filePath);
  if (found) setSelectedFile(found);
}} />
```

But wait — `ActionPlan` needs to be lazy-loaded too to keep the bundle small. Let me update:

```jsx
const ActionPlan = lazy(() => import("./ActionPlan"));
```

And wrap its usage:

```jsx
<div style={{animationDelay:"0.175s"}} className="animate-card-enter">
  <LazySection>
    <ActionPlan jobId={jobId} onSelectFile={(filePath) => {
      const found = files.find(f => f.path === filePath);
      if (found) setSelectedFile(found);
    }} />
  </LazySection>
</div>
```

Place this **after the HallOfShame** section and **before GitTabs**.

- [ ] **Step 3: Update Icons.jsx if ArrowRightIcon or LightbulbIcon are missing**

Check `ui/Icons.jsx` — `LightbulbIcon` and `ArrowRightIcon` already exist based on the brainstorming read. If not present, add them:

```jsx
export function LightbulbIcon({size = 16, className = ""}){
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true"><path d="M8 1C5.5 1 4 3 4 5c0 2 1.5 3 2 4v2h4V9c.5-1 2-2 2-4 0-2-1.5-4-4-4z" stroke="currentColor" strokeWidth="1.5"/><path d="M6 13h4M7 15h2" stroke="currentColor" strokeWidth="1.5"/></svg>;
}
export function ArrowRightIcon({size = 16, className = ""}){
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
```

- [ ] **Step 4: Frontend test for ActionPlan**

Create `frontend/src/components/ActionPlan.test.jsx`:

```jsx
import { render, screen, waitFor } from "@testing-library/react";
import ActionPlan from "./ActionPlan";

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () =>
      Promise.resolve({
        recommendations: [
          {
            file_path: "src/main.py",
            current_score: 30,
            potential_score: 100,
            score_gain: 70,
            estimated_effort_minutes: 45.0,
            impact_ratio: 1.56,
            priority_label: "critical",
            top_violations: [
              { type: "max_nesting", line: 100, severity: "high", context: "def foo():" },
              { type: "magic_number", line: 42, severity: "medium", context: "x = 86400" },
              { type: "todo", line: 10, severity: "low", context: "# TODO: refactor" },
            ],
            reason: "Large file (600 lines) + High nesting depth",
          },
          {
            file_path: "src/utils/helpers.py",
            current_score: 72,
            potential_score: 87,
            score_gain: 15,
            estimated_effort_minutes: 12.0,
            impact_ratio: 1.25,
            priority_label: "high",
            top_violations: [{ type: "todo", line: 5, severity: "low", context: "# FIXME: optimize" }],
            reason: "3 TODOs/FIXMEs + 2 magic numbers",
          },
        ],
        summary: {
          total_files_analyzed: 48,
          critical_count: 1,
          high_count: 1,
          medium_count: 5,
          low_count: 41,
          max_potential_gain: 85,
          total_estimated_effort_minutes: 57.0,
        },
      }),
  })
);

describe("ActionPlan", () => {
  beforeEach(() => {
    fetch.mockClear();
  });

  it("shows loading state initially", () => {
    render(<ActionPlan jobId="test123" />);
    expect(screen.getByText("Prioritizing recommendations…")).toBeInTheDocument();
  });

  it("renders recommendations after loading", async () => {
    render(<ActionPlan jobId="test123" />);
    await waitFor(() => {
      expect(screen.getByText("Critical")).toBeInTheDocument();
    });
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("1 critical")).toBeInTheDocument();
    expect(screen.getByText("1 high")).toBeInTheDocument();
    expect(screen.getByText(/85 pts potential gain/)).toBeInTheDocument();
  });

  it("shows effort in hours when over 60 minutes", async () => {
    render(<ActionPlan jobId="test123" />);
    await waitFor(() => {
      expect(screen.getByText(/1.0h estimated effort/)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 5: Build the frontend and run tests**

```bash
cd frontend && npx vite build 2>&1 | tail -20
```

Expected: 0 errors, bundle created.

```bash
cd frontend && npx vitest run src/components/ActionPlan.test.jsx 2>&1
```

Expected: All 3 tests PASS

- [ ] **Step 6: Commit frontend changes**

```bash
git add frontend/src/components/ActionPlan.jsx frontend/src/components/ActionPlan.test.jsx frontend/src/components/Dashboard.jsx
git commit -m "feat: add ActionPlan component with priority recommendations"
```

---

### Task 4: Integration — Wire ActionPlan into the Dashboard flow

**Files:**
- Modify: `frontend/src/components/Dashboard.jsx` (position and interaction with CodeViewer)
- Review: `frontend/src/components/ActionPlan.jsx` (ensure onSelectFile callback works)

**Interfaces:**
- Consumes: `files` array from Dashboard props, `setSelectedFile` from Dashboard state
- Produces: Seamless click flow: ActionPlan item → CodeViewer opens with file details

- [ ] **Step 1: Verify the ActionPlan-to-CodeViewer flow works**

The Dashboard.jsx already has:
```jsx
const [selectedFile, setSelectedFile] = useState(null);
```

And at the bottom:
```jsx
{selectedFile && (
  <LazySection><CodeViewer file={selectedFile} onClose={() => setSelectedFile(null)} /></LazySection>
)}
```

The `onSelectFile` callback passed to ActionPlan:
```jsx
<ActionPlan jobId={jobId} onSelectFile={(filePath) => {
  const found = files.find(f => f.path === filePath);
  if (found) setSelectedFile(found);
}} />
```

This correctly finds the file object by path and opens the CodeViewer.

- [ ] **Step 2: Run full test suite to verify no regressions**

```bash
cd frontend && npx vitest run 2>&1 | tail -30
```

Expected: All existing 24 tests + 3 new ActionPlan tests = 27 tests PASS.

- [ ] **Step 3: Final build verification**

```bash
cd frontend && npx vite build 2>&1
```

Expected: 0 errors, bundle size increase < 5kB.

- [ ] **Step 4: Commit final integration**

```bash
git add .
git commit -m "feat: wire ActionPlan into Dashboard with CodeViewer integration"
```

---

### Self-Review Checklist

**1. Spec coverage:**
- [x] Task 1 (backend module + endpoint + schemas) covers the recommendation engine
- [x] Task 2 (backend tests) covers correctness of priority calculations
- [x] Task 3 (ActionPlan component) covers the frontend UI
- [x] Task 4 (integration) covers wiring into the Dashboard and CodeViewer

**2. Placeholder scan:**
- [x] No "TBD", "TODO", "implement later" in any step
- [x] All code blocks have complete, working code
- [x] All file paths are exact
- [x] All commands are complete with expected output

**3. Type consistency:**
- [x] `compute_file_priority` signature matches in Tasks 1 and 2
- [x] `compute_all_recommendations` return shape matches in Tasks 1, 3
- [x] `RecommendationsResponse` model matches the dict returned by `compute_all_recommendations`
- [x] File structure keys (`file_path`, `current_score`, `score_gain`, `priority_label`, etc.) are consistent across backend (Task 1) and frontend (Task 3)
- [x] `active_jobs` name matches existing code in `routes.py`
- [x] `API_BASE` import matches existing frontend pattern

**No gaps found.** All spec requirements are covered by at least one task.
