"""
Badge Generator — Genera badges SVG dinámicos para GitHub.
"""

GRADE_COLORS = {
    "A": "#22c55e",
    "B": "#84cc16",
    "C": "#f59e0b",
    "D": "#f97316",
    "F": "#ef4444",
}


def generate_grade_badge(grade: str, score: int) -> str:
    """Genera un badge SVG con el grado y score de DebtRadar."""
    color = GRADE_COLORS.get(grade, "#6b7280")
    label_text = f"DebtRadar"
    value_text = f"{grade} ({score}/100)"

    label_width = len(label_text) * 7 + 16
    value_width = len(value_text) * 7 + 16
    total_width = label_width + value_width

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="a">
    <rect width="{total_width}" height="20" rx="3" fill="#fff"/>
  </mask>
  <g mask="url(#a)">
    <rect width="{label_width}" height="20" fill="#555"/>
    <rect x="{label_width}" width="{value_width}" height="20" fill="{color}"/>
    <rect width="{total_width}" height="20" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="{label_width // 2}" y="15" fill="#010101" fill-opacity=".3">{label_text}</text>
    <text x="{label_width // 2}" y="14">{label_text}</text>
    <text x="{label_width + value_width // 2}" y="15" fill="#010101" fill-opacity=".3">{value_text}</text>
    <text x="{label_width + value_width // 2}" y="14">{value_text}</text>
  </g>
</svg>'''


def generate_error_badge() -> str:
    """Genera un badge SVG de error cuando no hay datos."""
    label_text = "DebtRadar"
    value_text = "no data"
    label_width = len(label_text) * 7 + 16
    value_width = len(value_text) * 7 + 16
    total_width = label_width + value_width

    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="20">
  <linearGradient id="b" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <mask id="a">
    <rect width="{total_width}" height="20" rx="3" fill="#fff"/>
  </mask>
  <g mask="url(#a)">
    <rect width="{label_width}" height="20" fill="#555"/>
    <rect x="{label_width}" width="{value_width}" height="20" fill="#6b7280"/>
    <rect width="{total_width}" height="20" fill="url(#b)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="11">
    <text x="{label_width // 2}" y="15" fill="#010101" fill-opacity=".3">{label_text}</text>
    <text x="{label_width // 2}" y="14">{label_text}</text>
    <text x="{label_width + value_width // 2}" y="15" fill="#010101" fill-opacity=".3">{value_text}</text>
    <text x="{label_width + value_width // 2}" y="14">{value_text}</text>
  </g>
</svg>'''
