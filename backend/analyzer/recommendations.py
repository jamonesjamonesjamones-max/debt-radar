"""
Recommendations - Priority engine that tells developers which files to fix first.
Computes a priority score per file using heuristics over existing scan data.
"""

from typing import Any

# Severity multipliers - high severity violations get higher priority
SEVERITY_MULTIPLIERS = {
    "high": 3.0,
    "medium": 1.5,
    "low": 1.0,
}

# Estimated effort (minutes) per violation, by type
EFFORT_PER_VIOLATION = {
    "max_nesting": 15,
    "magic_number": 3,
    "todo": 5,
}

EFFORT_BASE_LINES_PER_MINUTE = 50


def compute_file_priority(file_data: dict) -> dict:
    deductions = file_data.get("deductions", {}) or {}
    violations = file_data.get("violations", []) or []
    lines = max(file_data.get("lines", 1), 1)
    current_score = file_data.get("score", 0)

    total_deductions = sum(d for d in deductions.values() if d < 0)
    potential_score = min(100, current_score + abs(total_deductions))
    score_gain = potential_score - current_score

    effort_minutes = lines / EFFORT_BASE_LINES_PER_MINUTE

    violation_type_counts = {}
    for v in violations:
        vtype = v.get("type", "")
        violation_type_counts[vtype] = violation_type_counts.get(vtype, 0) + 1

    for vtype, count in violation_type_counts.items():
        effort_per = EFFORT_PER_VIOLATION.get(vtype, 8)
        effort_minutes += count * effort_per * 0.7

    if lines > 800:
        effort_minutes *= 1.3
    elif lines > 500:
        effort_minutes *= 1.15

    impact_ratio = round(score_gain / max(effort_minutes, 1), 2)

    if impact_ratio >= 2.0:
        priority_label = "critical"
    elif impact_ratio >= 1.0:
        priority_label = "high"
    elif impact_ratio >= 0.5:
        priority_label = "medium"
    else:
        priority_label = "low"

    sorted_violations = sorted(
        violations,
        key=lambda v: {"high": 3, "medium": 2, "low": 1}.get(v.get("severity", "low"), 1),
        reverse=True,
    )
    top_violations = sorted_violations[:3]

    reason_parts = []
    if deductions.get("file_size", 0) < 0:
        reason_parts.append("Large file (%d lines)" % lines)
    if deductions.get("complexity", 0) < 0:
        reason_parts.append("High nesting depth")
    if violation_type_counts.get("magic_number", 0) > 0:
        reason_parts.append("%d magic numbers" % violation_type_counts["magic_number"])
    if violation_type_counts.get("todo", 0) > 0:
        reason_parts.append("%d TODOs/FIXMEs" % violation_type_counts["todo"])
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


def compute_all_recommendations(files):
    if not files:
        return {"recommendations": [], "summary": _empty_summary()}

    recs = [compute_file_priority(f) for f in files]
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


def _empty_summary():
    return {
        "total_files_analyzed": 0,
        "critical_count": 0,
        "high_count": 0,
        "medium_count": 0,
        "low_count": 0,
        "max_potential_gain": 0,
        "total_estimated_effort_minutes": 0,
    }
