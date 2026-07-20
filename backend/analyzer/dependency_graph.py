"""
Dependency Graph analyzer - Extracts import/require statements from file content
to build a directed graph of file dependencies within the scanned project.
"""

import re
import os

IMPORT_PATTERNS = {
    "python": [
        re.compile(r"^import\s+(\S+)", re.MULTILINE),
        re.compile(r"^from\s+(\S+)\s+import", re.MULTILINE),
    ],
    "javascript": [
        re.compile(r'require\(["\x27](.+?)["\x27]\)'),
        re.compile(r'from\s+["\x27](.+?)["\x27]'),
        re.compile(r'import\s+["\x27](.+?)["\x27]'),
    ],
    "typescript": [
        re.compile(r'require\(["\x27](.+?)["\x27]\)'),
        re.compile(r'from\s+["\x27](.+?)["\x27]'),
        re.compile(r'import\s+["\x27](.+?)["\x27]'),
    ],
}

DEFAULT_PATTERN = [
    re.compile(r'require\(["\x27](.+?)["\x27]\)'),
    re.compile(r'from\s+["\x27](.+?)["\x27]'),
    re.compile(r'import\s+["\x27](.+?)["\x27]'),
]


def _get_relative_path(file_path, imported):
    """Resolve a relative import to an absolute path within the project."""
    if not imported.startswith("."):
        return None
    base_dir = os.path.dirname(file_path)
    resolved = os.path.normpath(os.path.join(base_dir, imported))
    for ext in ["", ".js", ".jsx", ".ts", ".tsx", ".py"]:
        candidate = resolved + ext
        if os.path.isfile(candidate):
            return os.path.normpath(candidate)
        index_candidate = os.path.join(resolved, "index" + ext)
        if os.path.isfile(index_candidate):
            return os.path.normpath(index_candidate)
    return os.path.normpath(resolved)


def extract_imports(code, language, file_path):
    """Extract all import statements from source code."""
    patterns = IMPORT_PATTERNS.get(language, DEFAULT_PATTERN)
    imports = []
    seen = set()
    for pattern in patterns:
        for match in pattern.finditer(code):
            module = match.group(1).strip()
            if not module or module in seen:
                continue
            seen.add(module)
            resolved = _get_relative_path(file_path, module)
            if resolved:
                imports.append(resolved)
            else:
                imports.append(module)
    return imports


def build_dependency_graph(files, repo_path):
    """Build a dependency graph from scanned files."""
    if not repo_path.endswith(os.sep):
        repo_path += os.sep

    file_map = {}
    nodes = []
    for i, f in enumerate(files):
        rel_path = f["path"].replace(repo_path, "", 1).lstrip(os.sep)
        file_map[f["path"]] = i
        score = f.get("score", 50)
        violations = len(f.get("violations", []))
        nodes.append({
            "id": i,
            "name": rel_path or os.path.basename(f["path"]),
            "fullPath": f["path"],
            "score": score,
            "violations": violations,
            "lines": f.get("lines", 0),
            "language": f.get("language", "unknown"),
        })

    edges = []
    edge_set = set()
    for f in files:
        source_idx = file_map.get(f["path"])
        if source_idx is None:
            continue
        code = f.get("content", "")
        if not code:
            continue
        language = f.get("language", "unknown")
        imports = extract_imports(code, language, f["path"])

        for imp in imports:
            for scan_path, target_idx in file_map.items():
                if target_idx == source_idx:
                    continue
                norm_imp = imp.replace("\\", "/")
                norm_scan = scan_path.replace("\\", "/").replace(repo_path.replace("\\", "/"), "", 1).lstrip("/")
                if norm_imp.endswith(norm_scan) or norm_scan.endswith(norm_imp):
                    edge_key = (source_idx, target_idx)
                    if edge_key not in edge_set:
                        edge_set.add(edge_key)
                        edges.append({"source": source_idx, "target": target_idx})
                    break

    return {"nodes": nodes, "edges": edges}
