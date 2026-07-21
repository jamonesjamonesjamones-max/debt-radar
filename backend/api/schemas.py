"""
Modelos Pydantic para requests y responses de la API.
"""

from pydantic import BaseModel, Field
from typing import Optional


# === Request Models ===

class ScanRequest(BaseModel):
    """Request para iniciar un escaneo."""
    path: str = Field(..., description="Ruta absoluta del repositorio a escanear")
    workers: int = Field(default=4, ge=1, le=8, description="Número de workers paralelos")


# === Response Models ===

class Violation(BaseModel):
    """Violación detectada en un archivo."""
    type: str = Field(..., description="Tipo de violación: max_nesting, magic_number, todo")
    line: int = Field(..., description="Línea donde ocurre la violación")
    column: Optional[int] = Field(default=None, description="Columna de la violación")
    end_line: Optional[int] = Field(default=None, description="Línea final (para rangos)")
    severity: str = Field(..., description="Severidad: low, medium, high")
    context: str = Field(default="", description="Fragmento de código contextual")


class Deductions(BaseModel):
    """Deducciones aplicadas al score de un archivo."""
    file_size: int = Field(default=0)
    complexity: int = Field(default=0)
    todos: int = Field(default=0)
    magic_numbers: int = Field(default=0)
    function_complexity: int = Field(default=0)


class FileResult(BaseModel):
    """Resultado del análisis de un archivo individual."""
    path: str
    lines: int
    score: int
    language: str
    deductions: Deductions
    violations: list[Violation] = Field(default_factory=list)


class SkippedFile(BaseModel):
    """Archivo que fue omitido durante el escaneo."""
    path: str
    reason: str


class TopOffender(BaseModel):
    """Archivo entre los más problemáticos."""
    path: str
    score: int
    lines: int
    violations: int


class Summary(BaseModel):
    """Resumen general del escaneo."""
    total_files: int
    total_lines: int
    average_score: int
    grade: str
    grade_label: str = ""
    scan_time_seconds: float
    workers_used: int
    files_skipped: int
    total_violations: int = 0
    violations_by_type: dict[str, int] = Field(default_factory=dict)
    grade_distribution: dict[str, int] = Field(default_factory=dict)
    top_offenders: list[TopOffender] = Field(default_factory=list)


class ScanResponse(BaseModel):
    """Response completa del escaneo."""
    summary: Summary
    files: list[FileResult] = Field(default_factory=list)
    skipped_files: list[SkippedFile] = Field(default_factory=list)


class ScanJobCreated(BaseModel):
    """Response al crear un job de escaneo."""
    job_id: str
    status: str = "started"


class SSEProgress(BaseModel):
    """Evento de progreso enviado por SSE."""
    progress: float = Field(ge=0, le=100)
    elapsed: float
    current_file: str = ""
    files_completed: int = 0
    total_files: int = 0
    status: str = "running"  # running | completed | error
    result: Optional[ScanResponse] = None
    error: Optional[str] = None


class GraphNode(BaseModel):
    """A single node in the dependency graph."""
    id: int
    name: str
    fullPath: str
    score: int
    violations: int
    lines: int
    language: str


class GraphEdge(BaseModel):
    """A directed edge between two nodes."""
    source: int
    target: int


class DependencyGraphResponse(BaseModel):
    """Response with dependency graph data."""
    nodes: list[GraphNode]
    edges: list[GraphEdge]
