
"""Tests for the recommendation engine."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from analyzer.recommendations import compute_file_priority, compute_all_recommendations


def make_file(score=80, lines=200, deductions=None, violations=None):
    return {
        "path": "src/file_%d.py" % score,
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
    assert result["score_gain"] == 0
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
    assert result["score_gain"] >= 50
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
    assert result["score_gain"] == 15
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
        make_file(score=30, lines=600,
                  deductions={"file_size": -40, "complexity": -30, "todos": -15, "magic_numbers": -10, "function_complexity": -25},
                  violations=[{"type": "max_nesting", "line": 100, "severity": "high", "context": "def foo():"}]),
        make_file(score=85, lines=100,
                  deductions={"file_size": 0, "complexity": 0, "todos": -5, "magic_numbers": 0, "function_complexity": 0},
                  violations=[{"type": "todo", "line": 5, "severity": "low", "context": "# TODO"}]),
        make_file(score=55, lines=350,
                  deductions={"file_size": -20, "complexity": -15, "todos": -8, "magic_numbers": -5, "function_complexity": 0},
                  violations=[{"type": "max_nesting", "line": 42, "severity": "high", "context": "if x:"},
                              {"type": "magic_number", "line": 10, "severity": "medium", "context": "x = 60"}]),
    ]
    result = compute_all_recommendations(files)
    assert len(result["recommendations"]) == 3
    ratios = [r["impact_ratio"] for r in result["recommendations"]]
    assert ratios == sorted(ratios, reverse=True), "Should be sorted by impact ratio descending"
    assert result["summary"]["total_files_analyzed"] == 3
    assert result["summary"]["critical_count"] >= 0
    assert result["summary"]["high_count"] >= 0
