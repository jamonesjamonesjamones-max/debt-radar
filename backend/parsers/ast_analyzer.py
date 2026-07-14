"""
AST Analyzer: Análisis iterativo con Tree-sitter, captura de ubicaciones.
Detecta: nesting, complejidad por función, magic numbers, TODOs.
"""

import os
from typing import Any

from parsers.parser_pool import PARSERS, get_language_name
from parsers.regex_patterns import TODO_PATTERNS

# === Nodos que incrementan el anidamiento lógico (solo control flow) ===
NESTING_NODES = {
    "python": {
        "if_statement", "elif_clause", "else_clause",
        "for_statement", "while_statement",
        "try_statement", "except_clause", "finally_clause",
        "with_statement",
        "function_definition", "async_function_definition",
        "class_definition",
    },
    "javascript": {
        "if_statement", "else_clause",
        "for_statement", "for_in_statement", "for_of_statement",
        "while_statement", "do_statement",
        "switch_statement", "case_clause", "default_clause",
        "try_statement", "catch_clause", "finally_clause",
        "function_declaration", "function_expression",
        "arrow_function", "method_definition",
        "class_declaration",
    },
    "typescript": {
        "if_statement", "else_clause",
        "for_statement", "for_in_statement", "for_of_statement",
        "while_statement", "do_statement",
        "switch_statement", "case_clause", "default_clause",
        "try_statement", "catch_clause", "finally_clause",
        "function_declaration", "function_expression",
        "arrow_function", "method_definition",
        "class_declaration",
    },
}

# === Nodos que representan ramas (branching) por lenguaje ===
BRANCH_NODES = {
    "python": {
        "if_statement", "elif_clause", "for_statement", "while_statement",
        "try_statement", "except_clause", "with_statement",
        "boolean_operator",  # and/or
    },
    "javascript": {
        "if_statement", "else_clause", "for_statement", "for_in_statement",
        "while_statement", "do_statement", "switch_statement", "case_clause",
        "try_statement", "catch_clause", "ternary_expression",
        "logical_expression",  # &&, ||
    },
    "typescript": {
        "if_statement", "else_clause", "for_statement", "for_in_statement",
        "while_statement", "do_statement", "switch_statement", "case_clause",
        "try_statement", "catch_clause", "ternary_expression",
        "logical_expression",
    },
}

# === Nodos de función por lenguaje ===
FUNCTION_NODES = {
    "python": {"function_definition", "async_function_definition"},
    "javascript": {
        "function_declaration", "function_expression",
        "arrow_function", "method_definition",
    },
    "typescript": {
        "function_declaration", "function_expression",
        "arrow_function", "method_definition",
    },
}

# === Whitelist de magic numbers benignos ===
BENIGN_NUMBERS = {-1, 0, 1, 2, 10, 100, 1000}

# Contextos donde un número NO es sospechoso
BENIGN_CONTEXTS = {
    "subscript", "range", "array", "list", "tuple",
    "argument_list", "parameters", "keyword_argument",
    "slice", "import_from_statement",
}

# === Lenguajes soportados ===
SUPPORTED_LANGUAGES = {"python", "javascript", "typescript"}


def _is_nesting_node(node, language: str) -> bool:
    """Verifica si un nodo incrementa el anidamiento lógico."""
    return node.type in NESTING_NODES.get(language, set())


def _is_function_node(node, language: str) -> bool:
    """Verifica si un nodo es una definición de función."""
    return node.type in FUNCTION_NODES.get(language, set())


def _is_branch_node(node, language: str) -> bool:
    """Verifica si un nodo es una rama (if, for, while, etc.)."""
    return node.type in BRANCH_NODES.get(language, set())


def _is_suspicious_magic_number(node, parent_node) -> bool:
    """
    Determina si un nodo numérico es un magic number sospechoso.
    Whitelist de valores benignos + filtro de contextos.
    """
    if node.type not in ("integer", "float", "number"):
        return False

    try:
        text = node.text.decode("utf-8").strip()
        # Intentar parsear como entero
        value = int(text)
        if value in BENIGN_NUMBERS:
            return False
    except (ValueError, UnicodeDecodeError):
        # Si no es un entero simple (hex, bin, etc.), considerarlo sospechoso
        pass

    # Verificar contexto padre
    if parent_node and parent_node.type in BENIGN_CONTEXTS:
        return False

    return True


def analyze_file(filepath: str) -> dict[str, Any] | None:
    """
    Analiza un archivo completo con Tree-sitter.
    Retorna un dict con métricas y violaciones, o None si no se puede analizar.
    """
    # Detectar extensión y lenguaje
    _, ext = os.path.splitext(filepath)
    ext = ext.lower()

    parser = PARSERS.get(ext)
    if not parser:
        return None

    language = get_language_name(ext)
    if language not in SUPPORTED_LANGUAGES:
        return None

    # Leer archivo (límite 1MB por seguridad)
    try:
        file_size = os.path.getsize(filepath)
        if file_size > 1_000_000:
            return None
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except (OSError, PermissionError):
        return None

    if not content.strip():
        return None

    # Parsear AST
    try:
        tree = parser.parse(content.encode("utf-8"))
    except Exception:
        return None

    # === Inicializar métricas ===
    lines_list = content.split("\n")
    line_count = len(lines_list)

    metrics = {
        "lines": line_count,
        "max_nesting": 0,
        "max_function_branches": 0,
        "todos": 0,
        "magic_numbers_suspicious": 0,
        "violations": [],
    }

    # === Recorrido iterativo con pila ===
    # Dos depths: raw (AST) y logical (solo control flow)
    stack = [(tree.root_node, 0, 0, None)]  # (node, raw_depth, logical_depth, parent)
    active_functions = []   # stack of currently-open function scopes
    all_functions = []      # flat list of all functions (for max_function_branches)
    todo_patterns = TODO_PATTERNS.get(language, [])

    while stack:
        node, raw_depth, logical_depth, parent = stack.pop()

        # --- Pop function scopes we have exited ---
        # A function scope is active while the current node's byte range is
        # contained within the function's byte range.
        while active_functions and not (
            active_functions[-1]["node"].start_byte <= node.start_byte
            and node.end_byte <= active_functions[-1]["node"].end_byte
        ):
            active_functions.pop()

        # Si este nodo es de control flow, incrementar logical depth
        if _is_nesting_node(node, language):
            logical_depth += 1

        # --- Tracking de anidamiento máximo (solo nodos de control flow) ---
        if _is_nesting_node(node, language) and logical_depth > metrics["max_nesting"]:
            metrics["max_nesting"] = logical_depth
            # Solo reportar como violación cuando el nesting es realmente profundo (>4)
            if logical_depth > 4:
                metrics["violations"].append({
                    "type": "max_nesting",
                    "line": node.start_point[0] + 1,
                    "column": node.start_point[1],
                    "end_line": node.end_point[0] + 1,
                    "severity": "high" if logical_depth > 6 else "medium",
                    "context": _safe_text(node, 100),
                })

        # --- Magic numbers ---
        if _is_suspicious_magic_number(node, parent):
            metrics["magic_numbers_suspicious"] += 1
            metrics["violations"].append({
                "type": "magic_number",
                "line": node.start_point[0] + 1,
                "column": node.start_point[1],
                "end_line": None,
                "severity": "low",
                "context": _safe_text(node, 50),
            })

        # --- Tracking de funciones (con scope correcto) ---
        if _is_function_node(node, language):
            func_data = {"branches": 0, "node": node}
            active_functions.append(func_data)
            all_functions.append(func_data)
        elif active_functions and _is_branch_node(node, language):
            # Solo contar branches dentro de la función más interna activa
            active_functions[-1]["branches"] += 1

        # Empujar hijos (reversed para mantener orden)
        for child in reversed(node.children):
            stack.append((child, raw_depth + 1, logical_depth, node))

    # --- Calcular complejidad máxima por función ---
    if all_functions:
        metrics["max_function_branches"] = max(
            f["branches"] for f in all_functions
        )

    # --- Detección de TODOs con regex (línea por línea) ---
    for i, line in enumerate(lines_list, 1):
        for pattern in todo_patterns:
            if pattern.search(line):
                metrics["todos"] += 1
                metrics["violations"].append({
                    "type": "todo",
                    "line": i,
                    "column": None,
                    "end_line": None,
                    "severity": "low",
                    "context": line.strip()[:100],
                })
                break  # Un TODO por línea

    return metrics


def _safe_text(node, max_len: int = 100) -> str:
    """Extrae texto del nodo de forma segura, limpiando control chars."""
    try:
        text = node.text.decode("utf-8", errors="ignore")
        # Reemplazar control chars y saltos de línea para JSON safety
        text = text.replace("\n", " ").replace("\r", " ").replace("\t", " ")
        # Colapsar espacios múltiples
        text = " ".join(text.split())
        return text[:max_len]
    except Exception:
        return ""
