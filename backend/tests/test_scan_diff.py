
"""Tests for the scan diff engine."""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from analyzer.scan_diff import compute_file_diff, compute_full_diff


def make_file(path="src/test.py", score=80, lines=200, violations=None):
    return {
        "path": path,
        "lines": lines,
        "score": score,
        "language": "python",
        "deductions": {"file_size": 0, "complexity": 0, "todos": 0, "magic_numbers": 0, "function_complexity": 0},
        "violations": violations or [],
    }


def test_compute_file_diff_improved():
    curr = make_file(path="src/test.py", score=80, violations=[{"type": "magic_number", "line": 42, "severity": "low", "context": "x = 60"}])
    prev = make_file(path="src/test.py", score=40, violations=[{"type": "max_nesting", "line": 100, "severity": "high", "context": "def foo():"}, {"type": "magic_number", "line": 42, "severity": "low", "context": "x = 60"}])
    result = compute_file_diff(curr, prev)
    assert result["status"] == "improved"
    assert result["score_change"] == 40
    assert result["violations_removed_count"] == 1


def test_compute_file_diff_regressed():
    curr = make_file(path="src/test.py", score=40, violations=[{"type": "max_nesting", "line": 100, "severity": "high", "context": "if x:"}])
    prev = make_file(path="src/test.py", score=80)
    result = compute_file_diff(curr, prev)
    assert result["status"] == "regressed"
    assert result["score_change"] == -40


def test_compute_file_diff_new():
    curr = make_file(path="src/new.py", score=60)
    result = compute_file_diff(curr, None)
    assert result["status"] == "new"


def test_compute_full_diff_summary():
    current = [
        make_file(path="src/a.py", score=80),
        make_file(path="src/b.py", score=40),
        make_file(path="src/c.py", score=90),
    ]
    previous = [
        make_file(path="src/a.py", score=40),
        make_file(path="src/b.py", score=80),
    ]
    result = compute_full_diff(current, previous)
    assert result["summary"]["improved"] == 1
    assert result["summary"]["regressed"] == 1
    assert result["summary"]["new_files"] == 1
    assert result["summary"]["total_files_changed"] == 3


def test_compute_full_diff_sorting():
    current = [make_file(path="src/new.py", score=60), make_file(path="src/improved.py", score=80)]
    prev = [make_file(path="src/improved.py", score=40)]
    result = compute_full_diff(current, prev)
    # Regressed should come first, then new, then improved
    assert result["diffs"][0]["status"] == "new"
    assert result["diffs"][1]["status"] == "improved"
