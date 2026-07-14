"""
Parser Pool: Inicialización de parsers Tree-sitter por worker.
Cada worker importa esto una vez a nivel de módulo.
"""

import tree_sitter_python as tspython
import tree_sitter_javascript as tsjavascript
import tree_sitter_typescript as tstypescript
from tree_sitter import Language, Parser

# === Lenguajes (a nivel de módulo, se inicializan una vez por worker) ===
PYTHON_LANGUAGE = Language(tspython.language())
JS_LANGUAGE = Language(tsjavascript.language())
TS_LANGUAGE = Language(tstypescript.language_typescript())
TSX_LANGUAGE = Language(tstypescript.language_tsx())

# === Diccionario de parsers por extensión ===
PARSERS: dict[str, Parser] = {
    ".py": Parser(PYTHON_LANGUAGE),
    ".js": Parser(JS_LANGUAGE),
    ".jsx": Parser(JS_LANGUAGE),
    ".ts": Parser(TS_LANGUAGE),
    ".tsx": Parser(TSX_LANGUAGE),
}


def get_parser_for_extension(ext: str) -> Parser | None:
    """Retorna el parser Tree-sitter apropiado para la extensión dada."""
    return PARSERS.get(ext.lower())


def get_language_name(ext: str) -> str:
    """Retorna el nombre del lenguaje para la extensión dada."""
    mapping = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
    }
    return mapping.get(ext.lower(), "unknown")
