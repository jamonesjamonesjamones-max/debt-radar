"""
Rutas de la API: POST /api/scan, GET /api/scan/{job_id}/stream (SSE)
Integrado con el scanner real y el orchestrator.
"""

import asyncio
import json
import os
import time
import uuid
from datetime import datetime
from typing import Any

import tempfile

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse

from api.schemas import ScanRequest, ScanJobCreated
from analyzer.scanner import discover_files
from analyzer.orchestrator import run_scan_job, safe_process_file
from analyzer.metrics import aggregate_results
from utils.badges import generate_grade_badge, generate_error_badge
from utils.report_generator import generate_html_report
from analyzer.git_history import analyze_last_n_commits
from analyzer.git_blame import analyze_blame
from analyzer.recommendations import compute_all_recommendations
from analyzer.scan_diff import compute_full_diff
from analyzer.dependency_graph import build_dependency_graph
from utils.git_utils import is_git_repo
from utils.llm_client import check_ollama_status, get_refactor_suggestion
from utils.history_db import save_scan, compare_with_last, get_scan_history, get_all_latest_scans
from utils.path_security import is_sensitive_system_path

router = APIRouter()

# Diccionario en memoria para trackear el estado de cada job
active_jobs: dict[str, dict[str, Any]] = {}

# Límites de seguridad
MAX_ACTIVE_JOBS = 100
MAX_CONCURRENT_SCANS = 5


def _cleanup_old_jobs():
    """Elimina jobs completados/error para evitar memory leak."""
    if len(active_jobs) <= MAX_ACTIVE_JOBS:
        return
    to_remove = []
    for jid, job in active_jobs.items():
        if job.get("status") in ("completed", "error"):
            to_remove.append(jid)
    for jid in to_remove[:-50]:
        active_jobs.pop(jid, None)


def _count_running_scans() -> int:
    """Cuenta escaneos actualmente en progreso."""
    return sum(1 for j in active_jobs.values() if j.get("status") == "running")


def _validate_path(path: str) -> str:
    """
    Valida y expande el path. Lanza HTTPException si es inválido.
    Retorna el path expandido y normalizado.
    """
    if not path or not path.strip():
        raise HTTPException(status_code=400, detail="Path cannot be empty")

    # Resolver ~ y normalizar
    expanded = os.path.expanduser(path.strip())
    expanded = os.path.abspath(expanded)

    # Bloquear directorios sensibles del sistema (multiplataforma)
    if is_sensitive_system_path(expanded):
        raise HTTPException(
            status_code=403,
            detail="Access denied to system directory",
        )

    # Validar existencia
    if not os.path.exists(expanded):
        raise HTTPException(status_code=404, detail="Path not found")

    # Validar que sea un directorio
    if not os.path.isdir(expanded):
        raise HTTPException(status_code=400, detail="Path is not a directory")

    # Verificar permisos de lectura
    if not os.access(expanded, os.R_OK):
        raise HTTPException(status_code=403, detail="Read permission denied")

    return expanded


# Extensiones de archivo permitidas para subida
ALLOWED_UPLOAD_EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx"}
MAX_UPLOAD_SIZE = 1 * 1024 * 1024  # 1MB


@router.post("/scan/upload")
async def upload_and_scan(file: UploadFile = File(...)):
    """
    Recibe un archivo individual, lo analiza y devuelve el resultado.
    El archivo se guarda temporalmente y se elimina tras el análisis.
    """
    # Validar que hay archivo
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    # Validar extensión
    _, ext = os.path.splitext(file.filename)
    if ext.lower() not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_UPLOAD_EXTENSIONS))}"
        )

    # Leer contenido
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({len(content)} bytes). Maximum is {MAX_UPLOAD_SIZE // 1024}KB."
        )

    # Guardar a archivo temporal y analizar
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(
            suffix=ext, mode="wb", delete=False
        ) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        # Analizar con el mismo pipeline que usa el scan normal
        result = safe_process_file(tmp_path)

        # Si el archivo fue marcado como skipped, devolver error
        if result.get("skipped"):
            raise HTTPException(
                status_code=422,
                detail=f"Could not analyze file: {result.get('reason', 'Unknown error')}"
            )

        return JSONResponse(content={
            "filename": file.filename,
            "path": file.filename,
            "language": result.get("language", "unknown"),
            "lines": result.get("lines", 0),
            "score": result.get("score", 0),
            "deductions": result.get("deductions", {}),
            "violations": result.get("violations", []),
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis error: {str(e)[:200]}"
        )
    finally:
        # Limpiar archivo temporal
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass


@router.post("/scan", response_model=ScanJobCreated)
async def create_scan(request: ScanRequest):
    """
    Crea un job de escaneo real.
    1. Valida el path
    2. Descubre archivos con el scanner
    3. Lanza el análisis real como background task
    """
    # Rate limiting: máximo 5 escaneos simultáneos
    if _count_running_scans() >= MAX_CONCURRENT_SCANS:
        raise HTTPException(
            status_code=429,
            detail=f"Maximum {MAX_CONCURRENT_SCANS} concurrent scans. Wait for one to finish.",
        )

    # Validar path
    expanded_path = _validate_path(request.path)

    # Limpiar jobs antiguos
    _cleanup_old_jobs()

    # Descubrir archivos
    file_paths, skipped_files = discover_files(expanded_path)

    if not file_paths:
        raise HTTPException(
            status_code=404,
            detail="No analyzable files found (.py, .js, .ts, .tsx)",
        )

    # Límite de archivos
    if len(file_paths) > 5000:
        raise HTTPException(
            status_code=400,
            detail=f"{len(file_paths)} files detected. Select a more specific subfolder (max 5000).",
        )

    # Generar job_id
    job_id = str(uuid.uuid4())[:8]

    # Registrar job
    active_jobs[job_id] = {
        "status": "running",
        "progress": 0.0,
        "elapsed": 0.0,
        "current_file": "",
        "files_completed": 0,
        "total_files": len(file_paths),
        "result": None,
        "error": None,
        "start_time": time.time(),
        "path": expanded_path,
        "workers": request.workers,
        "skipped_files": skipped_files,
    }

    # Lanzar escaneo real en background
    asyncio.create_task(_run_real_scan(job_id, file_paths, request.workers))

    return ScanJobCreated(job_id=job_id, status="started")


@router.get("/badge/{job_id}")
async def get_badge(job_id: str):
    """Retorna un badge SVG con el grado del escaneo."""
    job = active_jobs.get(job_id)
    if not job or job.get("status") != "completed" or not job.get("result"):
        svg = generate_error_badge()
        return StreamingResponse(
            iter([svg]),
            media_type="image/svg+xml",
            headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
        )

    summary = job["result"].get("summary", {})
    grade = summary.get("grade", "F")
    score = summary.get("average_score", 0)
    svg = generate_grade_badge(grade, score)

    return StreamingResponse(
        iter([svg]),
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


@router.post("/export-html")
async def export_html(request: Request):
    """Genera y retorna un reporte HTML autocontenido."""
    body = await request.json()
    job_id = body.get("job_id")

    if not job_id:
        raise HTTPException(status_code=400, detail="job_id requerido")

    job = active_jobs.get(job_id)
    if not job or job.get("status") != "completed" or not job.get("result"):
        raise HTTPException(status_code=404, detail="Job no encontrado o no completado")

    result = job["result"]
    summary = result.get("summary", {})
    files = result.get("files", [])
    skipped = result.get("skipped_files", [])

    html = generate_html_report(summary, files, skipped)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"debt-report-{timestamp}.html"

    return StreamingResponse(
        iter([html]),
        media_type="text/html",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-cache",
        },
    )


@router.get("/scan/{job_id}/history")
async def get_git_history(job_id: str, commits: int = 5):
    """Analyzes the score evolution over the last N commits."""
    job = active_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job no encontrado")

    repo_path = job.get("path")
    if not repo_path:
        raise HTTPException(status_code=400, detail="Path no disponible")

    if not is_git_repo(repo_path):
        raise HTTPException(status_code=400, detail="No es un repositorio Git")

    history = analyze_last_n_commits(repo_path, n=min(commits, 10))
    return history


@router.get("/scan/{job_id}/blame")
async def get_git_blame(job_id: str):
    """Crosses violations with code authors via git blame."""
    job = active_jobs.get(job_id)
    if not job or job.get("status") != "completed" or not job.get("result"):
        raise HTTPException(status_code=404, detail="Job no encontrado o no completado")

    repo_path = job.get("path")
    if not repo_path:
        raise HTTPException(status_code=400, detail="Path no disponible")

    if not is_git_repo(repo_path):
        raise HTTPException(status_code=400, detail="No es un repositorio Git")

    files = job["result"].get("files", [])
    blame_data = analyze_blame(repo_path, files)
    return blame_data


@router.get("/scan/{job_id}/recommendations")
async def get_recommendations(job_id: str):
    """
    Returns prioritized refactoring recommendations for a completed scan.
    Each file gets an impact ratio (score gain per minute of effort).
    Sorted by impact (highest first).
    """
    job = active_jobs.get(job_id)
    if not job or job.get("status") != "completed" or not job.get("result"):
        raise HTTPException(status_code=404, detail="Job not found or not completed")

    files = job["result"].get("files", [])
    if not files:
        raise HTTPException(status_code=404, detail="No files in scan result")

    recommendations = compute_all_recommendations(files)
    return recommendations


@router.get("/scan/{job_id}/diff")
async def get_scan_diff(job_id: str, against: str = ""):
    """
    Compare this scan's results against a previous scan.
    If  is empty, checks if comparison data exists.
    Otherwise compares against another job_id.
    """
    job = active_jobs.get(job_id)
    if not job or job.get("status") != "completed" or not job.get("result"):
        raise HTTPException(status_code=404, detail="Job not found or not completed")

    current_files = job["result"].get("files", [])

    if against:
        prev_job = active_jobs.get(against)
        if not prev_job or not prev_job.get("result"):
            raise HTTPException(status_code=404, detail="Previous job not found")
        previous_files = prev_job["result"].get("files", [])
        diff = compute_full_diff(current_files, previous_files)
        return diff
    else:
        # No against specified, return comparison from history if available
        comparison = job["result"].get("comparison")
        if not comparison:
            raise HTTPException(status_code=404, detail="No comparison data. Specify ?against=job_id to compare two scans.")
        return {"error": "Specify ?against=job_id for file-by-file diff", "comparison": comparison}


@router.get("/scan/{job_id}/dependency-graph")
async def get_dependency_graph(job_id: str):
    """
    Returns a dependency graph for the scanned files.
    Uses import/require statements to build a force-directed graph.
    """
    job = active_jobs.get(job_id)
    if not job or job.get("status") != "completed" or not job.get("result"):
        raise HTTPException(status_code=404, detail="Job not found or not completed")

    files = job["result"].get("files", [])
    if not files:
        raise HTTPException(status_code=404, detail="No files in scan result")

    repo_path = job.get("path", "")
    # Read file contents from disk for dependency analysis
    enriched = []
    for f in files:
        fp = f.get("path", "")
        content = ""
        if fp and os.path.isfile(fp):
            try:
                with open(fp, "r", encoding="utf-8", errors="ignore") as fh:
                    content = fh.read()
            except Exception:
                pass
        enriched.append({**f, "content": content})
    graph = build_dependency_graph(enriched, repo_path)
    return graph


@router.get("/scan/all-projects")
async def get_all_projects():
    """
    Returns the latest scan for each unique project path.
    Useful for a portfolio/CI dashboard view.
    """
    projects = get_all_latest_scans()
    return {"projects": projects, "total": len(projects)}


@router.get("/ollama-status")
async def ollama_status():
    """Checks if Ollama is running and what models are available."""
    return await check_ollama_status()


@router.post("/refactor-suggestion")
async def refactor_suggestion(request: Request):
    """Requests a refactor suggestion from Ollama."""
    body = await request.json()
    code = body.get("code", "")
    violation_type = body.get("violation_type", "")
    context = body.get("context", "")
    model = body.get("model", "llama3.2")

    if not code:
        raise HTTPException(status_code=400, detail="code requerido")

    result = await get_refactor_suggestion(code, violation_type, context, model)
    return result


@router.get("/scan/history")
async def scan_history(path: str, limit: int = 10):
    """Obtiene el historial de escaneos para un path."""
    history = get_scan_history(path, limit=min(limit, 50))
    return {"path": path, "history": history}


@router.get("/scan/{job_id}/stream")
async def scan_stream(job_id: str, request: Request):
    """
    SSE stream que emite progreso del escaneo cada 0.5s.
    Limpia el job cuando el cliente se desconecta.
    """
    if job_id not in active_jobs:
        raise HTTPException(status_code=404, detail=f"Job no encontrado")

    async def event_generator():
        try:
            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    # Marcar job como cancelado para detener workers
                    job = active_jobs.get(job_id)
                    if job and job.get("status") == "running":
                        job["status"] = "cancelled"
                    break

                job = active_jobs.get(job_id)
                if not job:
                    yield f"data: {json.dumps({'status': 'error', 'error': 'Job perdido'})}\n\n"
                    break

                payload = {
                    "progress": round(job["progress"], 1),
                    "elapsed": round(job["elapsed"], 2),
                    "current_file": job["current_file"],
                    "files_completed": job["files_completed"],
                    "total_files": job["total_files"],
                    "status": job["status"],
                }

                if job["status"] == "completed" and job["result"]:
                    payload["result"] = job["result"]
                    yield f"data: {json.dumps(payload)}\n\n"
                    break

                if job["status"] == "error":
                    payload["error"] = job["error"]
                    yield f"data: {json.dumps(payload)}\n\n"
                    break

                if job["status"] == "cancelled":
                    break

                yield f"data: {json.dumps(payload)}\n\n"
                await asyncio.sleep(0.5)
        finally:
            # Cleanup: remove completed/error/cancelled job after delay
            await asyncio.sleep(5)
            job = active_jobs.get(job_id)
            if job and job.get("status") in ("completed", "error", "cancelled"):
                active_jobs.pop(job_id, None)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _run_real_scan(job_id: str, file_paths: list[str], workers: int):
    """
    Ejecuta el escaneo real en un thread pool para no bloquear el event loop.
    """
    job = active_jobs.get(job_id)
    if not job:
        return

    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            run_scan_job,
            job_id,
            file_paths,
            workers,
            active_jobs,
            30,
        )

        # Agregar resultados con metrics centralizado.
        # El job queda en estado "aggregating" (ver orchestrator.run_scan_job) hasta
        # que el resultado tiene su "summary" completo. Solo entonces se marca
        # "completed", para que el SSE stream nunca envíe un resultado a medias.
        if job.get("status") == "cancelled":
            return

        result = job.get("result")
        if result:
            files = result.get("files", [])
            skipped = job.get("skipped_files", []) + result.get("skipped_files", [])

            job["result"] = aggregate_results(
                files=files,
                skipped_files=skipped,
                scan_time=job.get("elapsed", 0),
                workers_used=workers,
            )

            # Save to history and compare with last scan
            try:
                summary = job["result"].get("summary", {})
                save_scan(summary, job.get("path", ""))
                comparison = compare_with_last(summary, job.get("path", ""))
                if comparison:
                    job["result"]["comparison"] = comparison
                job["result"]["summary"]["scan_path"] = job.get("path", "")
            except Exception:
                pass  # No fallar el escaneo por errores de DB

            job["status"] = "completed"

    except Exception as e:
        job["status"] = "error"
        job["error"] = f"{type(e).__name__}: {str(e)[:200]}"
