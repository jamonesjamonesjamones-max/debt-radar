"""
Scan Diff - Compares two scan results to show what changed.
"""

from typing import Any


def compute_file_diff(current_file: dict, previous_file: dict) -> dict:
    """
    Compare a single file across two scans.
    Returns dict with: score_change, violations_added, violations_removed,
    current_violations_count, previous_violations_count, status.
    status is: improved | regressed | unchanged | new | removed.
    """
    current_score = current_file.get("score", 0)
    previous_score = previous_file.get("score", 0) if previous_file else 0
    score_change = current_score - previous_score

    current_violations = {v.get("type", ""): v for v in current_file.get("violations", [])}
    previous_violations = {v.get("type", ""): v for v in previous_file.get("violations", [])} if previous_file else {}

    current_types = set(current_violations.keys())
    previous_types = set(previous_violations.keys())

    types_added = current_types - previous_types
    types_removed = previous_types - current_types

    violations_added = [{"type": t, "line": current_violations[t].get("line", 0), "severity": current_violations[t].get("severity", "low")} for t in types_added]
    violations_removed = [{"type": t, "line": previous_violations[t].get("line", 0), "severity": previous_violations[t].get("severity", "low")} for t in types_removed]

    if not previous_file:
        status = "new"
    elif current_score > previous_score:
        status = "improved"
    elif current_score < previous_score:
        status = "regressed"
    else:
        status = "unchanged"

    return {
        "file_path": current_file.get("path", ""),
        "score_change": score_change,
        "current_score": current_score,
        "previous_score": previous_score,
        "status": status,
        "violations_added": violations_added,
        "violations_removed": violations_removed,
        "violations_added_count": len(violations_added),
        "violations_removed_count": len(violations_removed),
    }


def compute_full_diff(current_files: list[dict], previous_files: list[dict]) -> dict:
    """
    Compare all files between two scans.
    Returns { diffs, summary } with aggregated stats.
    """
    prev_by_path = {f.get("path", ""): f for f in (previous_files or [])}
    curr_by_path = {f.get("path", ""): f for f in (current_files or [])}

    all_paths = set(list(curr_by_path.keys()) + list(prev_by_path.keys()))
    diffs = []
    for path in sorted(all_paths):
        curr = curr_by_path.get(path)
        prev = prev_by_path.get(path)
        if curr:
            diffs.append(compute_file_diff(curr, prev))
        else:
            # File was removed in current scan
            diffs.append({
                "file_path": path,
                "score_change": 0,
                "current_score": 0,
                "previous_score": prev.get("score", 0) if prev else 0,
                "status": "removed",
                "violations_added": [],
                "violations_removed": [],
                "violations_added_count": 0,
                "violations_removed_count": 0,
            })

    improved = sum(1 for d in diffs if d["status"] == "improved")
    regressed = sum(1 for d in diffs if d["status"] == "regressed")
    unchanged = sum(1 for d in diffs if d["status"] == "unchanged")
    new_files = sum(1 for d in diffs if d["status"] == "new")
    removed_files = sum(1 for d in diffs if d["status"] == "removed")
    total_added = sum(d["violations_added_count"] for d in diffs)
    total_removed = sum(d["violations_removed_count"] for d in diffs)

    priority = {"regressed": 0, "new": 1, "improved": 2, "unchanged": 3, "removed": 4}
    diffs.sort(key=lambda d: priority.get(d["status"], 5))

    return {
        "diffs": diffs,
        "summary": {
            "total_files_changed": len(diffs),
            "improved": improved,
            "regressed": regressed,
            "unchanged": unchanged,
            "new_files": new_files,
            "removed_files": removed_files,
            "total_violations_added": total_added,
            "total_violations_removed": total_removed,
        },
    }
