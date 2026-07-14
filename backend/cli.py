"""
DebtRadar CLI — Auditor de salud de código desde la terminal.
Uso: python cli.py scan <path> [--workers N] [--output FORMAT]
"""

import sys
import os
import time
import json
from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn
from rich.panel import Panel
from rich.text import Text
from rich import box

# Agregar el directorio backend al path para imports
sys.path.insert(0, str(Path(__file__).parent))

from analyzer.scanner import discover_files
from analyzer.orchestrator import safe_process_file
from analyzer.metrics import aggregate_results, get_grade
from utils.path_security import is_sensitive_system_path

app = typer.Typer(
    name="debtradar",
    help="📡 DebtRadar — Forensic code health auditor.",
    add_completion=False,
)
console = Console()

# Colores por grado
GRADE_COLORS = {
    "A": "bold green",
    "B": "bold yellow",
    "C": "bold bright_yellow",
    "D": "bold bright_red",
    "F": "bold red",
}

GRADE_LABELS = {
    "A": "Clean Code",
    "B": "Minor Debt",
    "C": "High Debt",
    "D": "Fragile Code",
    "F": "Biohazard",
}

VIOLATION_COLORS = {
    "max_nesting": "red",
    "magic_number": "yellow",
    "todo": "cyan",
}


def _cli_worker_init():
    import parsers.parser_pool  # noqa


def _shorten_path(path: str, keep: int = 3) -> str:
    """Acorta un path a sus últimos `keep` componentes, multiplataforma."""
    parts = [p for p in Path(path).parts if p not in (os.sep, "/", "\\")]
    if len(parts) > keep:
        return str(Path(*parts[-keep:]))
    return path


def _run_scan(path: str, workers: int, max_files: int, quiet: bool = False) -> dict:
    """Ejecuta el escaneo con barra de progreso en terminal."""
    c = Console(stderr=True) if quiet else console
    # Validar path
    expanded = os.path.expanduser(path)
    expanded = os.path.abspath(expanded)

    if not os.path.exists(expanded):
        c.print(f"[red]❌ Error: Path no encontrado: {expanded}[/red]")
        raise typer.Exit(1)

    if not os.path.isdir(expanded):
        c.print(f"[red]❌ Error: No es un directorio: {expanded}[/red]")
        raise typer.Exit(1)

    if is_sensitive_system_path(expanded):
        c.print(f"[red]❌ Error: Acceso denegado a directorio del sistema: {expanded}[/red]")
        raise typer.Exit(1)

    # Descubrir archivos
    c.print(f"\n[bold]📡 DebtRadar[/bold] — Escaneando [cyan]{expanded}[/cyan]\n")

    with c.status("[bold green]Descubriendo archivos..."):
        file_paths, skipped = discover_files(expanded)

    if not file_paths:
        c.print("[yellow]⚠ No se encontraron archivos analizables (.py, .js, .ts, .tsx)[/yellow]")
        raise typer.Exit(0)

    if len(file_paths) > max_files:
        c.print(f"[yellow]⚠ {len(file_paths)} archivos encontrados, limitando a {max_files}[/yellow]")
        file_paths = file_paths[:max_files]

    c.print(f"  📁 {len(file_paths)} archivos encontrados, {len(skipped)} omitidos\n")

    # Analizar con barra de progreso
    results = []
    skipped_results = []
    start_time = time.time()

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(bar_width=40),
        TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
        TextColumn("({task.completed}/{task.total})"),
        TimeElapsedColumn(),
        console=c,
    ) as progress:
        task = progress.add_task("Analizando", total=len(file_paths))

        if workers <= 1:
            for filepath in file_paths:
                result = safe_process_file(filepath)
                if result.get("skipped"):
                    skipped_results.append(result)
                else:
                    results.append(result)
                progress.update(task, advance=1, description=f"[cyan]{os.path.basename(filepath)}[/cyan]")
        else:
            from concurrent.futures import ProcessPoolExecutor, as_completed

            with ProcessPoolExecutor(max_workers=workers, initializer=_cli_worker_init) as executor:
                futures = {executor.submit(safe_process_file, f): f for f in file_paths}
                for future in as_completed(futures):
                    filepath = futures[future]
                    try:
                        result = future.result(timeout=30)
                    except Exception:
                        result = {"path": filepath, "skipped": True, "reason": "Error"}
                    if result.get("skipped"):
                        skipped_results.append(result)
                    else:
                        results.append(result)
                    progress.update(task, advance=1, description=f"[cyan]{os.path.basename(filepath)}[/cyan]")

    elapsed = time.time() - start_time

    # Agregar resultados
    agg = aggregate_results(results, skipped_results, elapsed, workers)
    return agg


def _show_text_report(agg: dict):
    """Muestra el reporte en terminal con tablas y colores."""
    s = agg["summary"]
    files = agg["files"]

    # === Header con grado ===
    grade = s["grade"]
    grade_label = s.get("grade_label", GRADE_LABELS.get(grade, ""))
    color = GRADE_COLORS.get(grade, "white")

    header = Text()
    header.append(f"  {grade}  ", style=f"{color} on grey11")
    header.append(f"  {grade_label}", style=f"bold {color}")
    header.append(f"  Score: {s['average_score']}/100", style="dim")

    console.print(Panel(header, title="📡 DebtRadar Result", border_style="blue", padding=(1, 2)))

    # === Métricas ===
    metrics_table = Table(show_header=False, box=box.SIMPLE, padding=(0, 2))
    metrics_table.add_column("Metric", style="dim")
    metrics_table.add_column("Value", style="bold")

    metrics_table.add_row("📁 Archivos", str(s["total_files"]))
    metrics_table.add_row("📝 Líneas", f"{s['total_lines']:,}")
    metrics_table.add_row("⚠️  Violaciones", str(s["total_violations"]))
    metrics_table.add_row("⏱️  Tiempo", f"{s['scan_time_seconds']}s ({s['workers_used']} workers)")
    metrics_table.add_row("⏭️  Omitidos", str(s["files_skipped"]))

    console.print(metrics_table)

    # === Violaciones por tipo ===
    vbt = s.get("violations_by_type", {})
    if vbt:
        console.print("\n[bold]Violaciones por tipo:[/bold]")
        for vtype, count in vbt.items():
            color = VIOLATION_COLORS.get(vtype, "white")
            label = {"max_nesting": "Nesting", "magic_number": "Magic #", "todo": "TODOs"}.get(vtype, vtype)
            console.print(f"  [{color}]{label}[/{color}]: {count}")

    # === Distribución de grados ===
    gd = s.get("grade_distribution", {})
    if gd:
        console.print("\n[bold]Distribución de grados:[/bold]")
        for g in ["A", "B", "C", "D", "F"]:
            count = gd.get(g, 0)
            if count > 0:
                color = GRADE_COLORS.get(g, "white")
                console.print(f"  [{color}]{g}[/{color}]: {count}")

    # === Top Offenders ===
    top = s.get("top_offenders", [])
    if top:
        console.print("\n[bold]🏆 Top Offenders:[/bold]")
        table = Table(box=box.ROUNDED, show_lines=False)
        table.add_column("#", style="dim", width=3)
        table.add_column("Score", justify="right", width=5)
        table.add_column("Lines", justify="right", width=7)
        table.add_column("Viol", justify="right", width=5)
        table.add_column("File", style="cyan")

        for i, t in enumerate(top, 1):
            score = t["score"]
            g, _ = get_grade(score)
            color = GRADE_COLORS.get(g, "white")
            short_path = _shorten_path(t["path"])

            table.add_row(
                str(i),
                f"[{color}]{score}[/{color}]",
                f"{t['lines']:,}",
                str(t["violations"]),
                short_path,
            )

        console.print(table)

    # === Hall of Shame (all files) ===
    if files and len(files) > 0:
        sorted_files = sorted(files, key=lambda x: x.get("score", 100))
        console.print(f"\n[bold]📋 All files ({len(files)}):[/bold]")
        table = Table(box=box.SIMPLE, show_lines=False)
        table.add_column("Score", justify="right", width=5)
        table.add_column("Grade", justify="center", width=5)
        table.add_column("Lines", justify="right", width=7)
        table.add_column("Lang", width=10)
        table.add_column("Viol", justify="right", width=5)
        table.add_column("File")

        for f in sorted_files:
            score = f.get("score", 0)
            g, _ = get_grade(score)
            color = GRADE_COLORS.get(g, "white")
            lang = f.get("language", "?")
            vcount = len(f.get("violations", []))
            short = _shorten_path(f.get("path", ""))

            table.add_row(
                f"[{color}]{score}[/{color}]",
                f"[{color}]{g}[/{color}]",
                f"{f.get('lines', 0):,}",
                lang,
                str(vcount),
                short,
            )

        console.print(table)


@app.command()
def scan(
    path: str = typer.Argument(..., help="Repository path to scan"),
    workers: int = typer.Option(4, "--workers", "-w", min=1, max=8, help="Number of parallel workers"),
    output: str = typer.Option("text", "--output", "-o", help="Output format: text, json"),
    max_files: int = typer.Option(5000, "--max-files", help="Maximum files to analyze"),
    fail_below: str = typer.Option(None, "--fail-below", help="Fail if grade is below (A, B, C, D)"),
):
    """📡 Scan a repository and show the code health diagnosis."""
    agg = _run_scan(path, workers, max_files, quiet=(output == "json"))

    if output == "json":
        typer.echo(json.dumps(agg, indent=2, ensure_ascii=False))
    else:
        _show_text_report(agg)

    # Verificar --fail-below
    if fail_below:
        grade_order = {"A": 0, "B": 1, "C": 2, "D": 3, "F": 4}
        current = grade_order.get(agg["summary"]["grade"], 4)
        threshold = grade_order.get(fail_below.upper(), 4)
        if current > threshold:
            if output != "json":
                console.print(f"\n[red]❌ FAIL: Grade {agg['summary']['grade']} is below {fail_below.upper()}[/red]")
            raise typer.Exit(code=1)


@app.command()
def version():
    """Muestra la versión de DebtRadar."""
    console.print("[bold]DebtRadar[/bold] v1.0.0")


if __name__ == "__main__":
    app()
