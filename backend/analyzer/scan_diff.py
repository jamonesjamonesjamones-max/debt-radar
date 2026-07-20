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

    current_violations_list: list[dict] = current_file.get("violations", [])
    previous_violations_list: list[dict] = previous_file.get("violations", []) if previous_file else []

    # Contar violaciones por tipo en ambos escaneos
    def _count_by_type(violations: list[dict]) -> dict[str, int]:
        counts: dict[str, int] = {}
        for v in violations:
            vtype = v.get("type", "")
            counts[vtype] = counts.get(vtype, 0) + 1
        return counts

    current_counts = _count_by_type(current_violations_list)
    previous_counts = _count_by_type(previous_violations_list) if previous_file else {}

    # Comparar cantidades: detectar aumentos y disminuciones
    all_types = set(list(current_counts.keys()) + list(previous_counts.keys()))
    violations_added = []
    violations_removed = []

    for vtype in all_types:
        curr_count = current_counts.get(vtype, 0)
        prev_count = previous_counts.get(vtype, 0)

        if curr_count > prev_count:
            # Aumentó: reportar las "nuevas" violaciones de este tipo
            sample = next((v for v in current_violations_list if v.get("type") == vtype), None)
            violations_added.append({
                "type": vtype,
                "line": sample.get("line", 0) if sample else 0,
                "severity": sample.get("severity", "low") if sample else "low",
                "delta": curr_count - prev_count,
            })
        elif curr_count < prev_count:
            # Disminuyó: reportar las violaciones "eliminadas" de este tipo
            sample = next((v for v in previous_violations_list if v.get("type") == vtype), None)
            violations_removed.append({
                "type": vtype,
                "line": sample.get("line", 0) if sample else 0,
                "severity": sample.get("severity", "low") if sample else "low",
                "delta": prev_count - curr_count,
            })

    if not previous_file:
        status = "new"
    elif current_score > previous_score:
        status = "improved"
    elif current_score < previous_score:
        status = "regressed"
    else:
        # Si el score no cambió pero las violaciones cambiaron en cantidad,
        # verificar si hay diferencias en los counts
        if violations_added or violations_removed:
            # Determinar si es mejora o empeoramiento por cantidad neta
            net_change = sum(
                current_counts.get(t, 0) - previous_counts.get(t, 0)
                for t in all_types
            )
            if net_change < 0:
                status = "improved"
            elif net_change > 0:
                status = "regressed"
            else:
                # Misma cantidad pero diferentes tipos: reemplazo
                status = "regressed" if violations_added else "improved"
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
