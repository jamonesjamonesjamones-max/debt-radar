"""Tests for the dependency graph analyzer."""
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from analyzer.dependency_graph import build_dependency_graph, extract_imports


def test_extract_imports_python():
    code = "import os\nimport sys\nfrom collections import defaultdict"
    imports = extract_imports(code, "python", "/project/main.py")
    assert any("os" in i for i in imports)
    assert any("sys" in i for i in imports)


def test_empty():
    graph = build_dependency_graph([], "/project/")
    assert graph["nodes"] == []
    assert graph["edges"] == []


def test_no_content():
    files = [
        {"path": "/project/a.py", "language": "python", "score": 80, "violations": [], "lines": 50},
        {"path": "/project/b.py", "language": "python", "score": 90, "violations": [], "lines": 30},
    ]
    graph = build_dependency_graph(files, "/project/")
    assert len(graph["nodes"]) == 2
    assert len(graph["edges"]) == 0


def test_with_content():
    files = [
        {"path": "/project/main.py", "language": "python", "score": 80,
         "violations": [], "lines": 50, "content": "import os"},
        {"path": "/project/utils.py", "language": "python", "score": 90,
         "violations": [], "lines": 30, "content": "def helper(): pass"},
    ]
    graph = build_dependency_graph(files, "/project/")
    assert len(graph["nodes"]) == 2
    for node in graph["nodes"]:
        assert "id" in node
        assert "score" in node


def test_scores():
    files = [
        {"path": "/project/good.py", "language": "python", "score": 95,
         "violations": [], "lines": 10},
        {"path": "/project/bad.py", "language": "python", "score": 20,
         "violations": [{"type": "magic"}, {"type": "todo"}], "lines": 200},
    ]
    graph = build_dependency_graph(files, "/project/")
    bad = [n for n in graph["nodes"] if "bad.py" in n["name"]][0]
    assert bad["score"] == 20
    assert bad["violations"] == 2
    good = [n for n in graph["nodes"] if "good.py" in n["name"]][0]
    assert good["score"] == 95
