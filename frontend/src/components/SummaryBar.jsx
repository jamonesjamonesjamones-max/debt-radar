/**
 * SummaryBar — Métricas principales: grado, score, archivos, líneas, tiempo, violaciones.
 */

import { useState } from "react";
import { exportReport } from "../api/client";

const GRADE_COLORS = {
  A: "text-grade-a",
  B: "text-grade-b",
  C: "text-grade-c",
  D: "text-grade-d",
  F: "text-grade-f",
};

export default function SummaryBar({ summary, jobId }) {
  if (!summary) return null;

  const gradeColor = GRADE_COLORS[summary.grade] || "text-text-primary";
  const gradeLabel = summary.grade_label || "";
  const [exporting, setExporting] = useState(false);
  const [copiedBadge, setCopiedBadge] = useState(false);

  const handleExport = async () => {
    if (!jobId || exporting) return;
    setExporting(true);
    try {
      const blob = await exportReport(jobId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `debt-report-${Date.now()}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyBadge = () => {
    if (!jobId) return;
    const badgeUrl = `${window.location.protocol}//${window.location.hostname}:8000/api/badge/${jobId}`;
    const markdown = `![DebtRadar](${badgeUrl})`;
    navigator.clipboard.writeText(markdown).then(() => {
      setCopiedBadge(true);
      setTimeout(() => setCopiedBadge(false), 2000);
    });
  };

  return (
    <div className="card px-6 py-5">
      <div className="flex items-center justify-between flex-wrap gap-6">
        {/* Grado — elemento visual principal */}
        <div className="flex items-center gap-4">
          <div
            className={`text-5xl font-bold ${gradeColor} font-mono leading-none`}
          >
            {summary.grade}
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">
              {gradeLabel}
            </p>
            <p className="text-xs text-text-muted">
              Average score:{" "}
              <span className="font-mono">{summary.average_score}</span>/100
            </p>
          </div>
        </div>

        {/* Métricas secundarias */}
        <div className="flex items-center gap-8 flex-wrap">
          <Metric
            label="Files"
            value={summary.total_files}
            sub={summary.files_skipped > 0 ? `${summary.files_skipped} skipped` : null}
          />
          <Metric
            label="Lines"
            value={summary.total_lines?.toLocaleString() || "0"}
          />
          <Metric
            label="Issues"
            value={summary.total_violations || 0}
          />
          <Metric
            label="Scan time"
            value={`${summary.scan_time_seconds?.toFixed(1) || 0}s`}
            sub={`${summary.workers_used} workers`}
          />
        </div>

        {/* Botones de acción */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting || !jobId}
            className="px-3 py-1.5 rounded text-xs font-medium bg-surface-3 text-text-secondary hover:bg-surface-4 disabled:opacity-40 transition-colors"
            title="Download a self-contained HTML report"
          >
            {exporting ? "⏳ Exporting…" : "📥 Export"}
          </button>
          <button
            onClick={handleCopyBadge}
            disabled={!jobId}
            className="px-3 py-1.5 rounded text-xs font-medium bg-surface-3 text-text-secondary hover:bg-surface-4 disabled:opacity-40 transition-colors"
            title="Copy a Markdown badge for your README"
          >
            {copiedBadge ? "✅ Copied!" : "🏷️ Badge"}
          </button>
        </div>
      </div>

      {/* Distribución de grados */}
      {summary.grade_distribution && (
        <div className="mt-4 pt-4 border-t border-surface-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-text-muted">Grade distribution:</span>
            {["A", "B", "C", "D", "F"].map((g) => {
              const count = summary.grade_distribution[g] || 0;
              if (count === 0) return null;
              return (
                <span
                  key={g}
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${GRADE_COLORS[g]} bg-surface-3/50`}
                >
                  {g}: {count}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Violaciones por tipo */}
      {summary.violations_by_type &&
        Object.keys(summary.violations_by_type).length > 0 && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-text-muted">Issues found:</span>
            {Object.entries(summary.violations_by_type).map(([type, count]) => (
              <ViolationChip key={type} type={type} count={count} />
            ))}
          </div>
        )}
    </div>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div className="text-center">
      <p className="text-lg font-mono font-bold text-text-primary">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
      {sub && <p className="text-[10px] text-text-muted">{sub}</p>}
    </div>
  );
}

function ViolationChip({ type, count }) {
  const labels = {
    max_nesting: { label: "Nesting", color: "text-grade-f bg-grade-f/10" },
    magic_number: { label: "Magic #", color: "text-grade-c bg-grade-c/10" },
    todo: { label: "TODOs", color: "text-grade-b bg-grade-b/10" },
  };
  const info = labels[type] || {
    label: type,
    color: "text-text-secondary bg-surface-3",
  };

  return (
    <span
      className={`text-[11px] font-mono px-2 py-0.5 rounded ${info.color}`}
    >
      {info.label}: {count}
    </span>
  );
}
