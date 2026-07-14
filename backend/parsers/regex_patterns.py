"""
Regex patterns para detección de TODOs, FIXMEs y otros marcadores.
"""

import re

# Case-sensitive con límite de palabra (como especifica el plan)
# Soporta: TODO, FIXME, HACK, XXX, BUG
TODO_PATTERN = re.compile(r"#\s*(TODO|FIXME|HACK|XXX|BUG)\b")

# Versión para JS/TS (comentarios // y /* */)
TODO_PATTERN_JS = re.compile(r"//\s*(TODO|FIXME|HACK|XXX|BUG)\b")
TODO_PATTERN_JS_BLOCK = re.compile(r"/\*\s*(TODO|FIXME|HACK|XXX|BUG)\b")

# Mapa de patrones por lenguaje
TODO_PATTERNS = {
    "python": [TODO_PATTERN],
    "javascript": [TODO_PATTERN_JS, TODO_PATTERN_JS_BLOCK],
    "typescript": [TODO_PATTERN_JS, TODO_PATTERN_JS_BLOCK],
}
