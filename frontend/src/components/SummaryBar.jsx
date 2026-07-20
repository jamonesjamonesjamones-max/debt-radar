/**
 * SummaryBar — Resumen ejecutivo rediseñado con hero grade, tendencia, métricas y acciones.
 */

import { useState, memo, useEffect } from "react";
import { exportReport } from "../api/client";
import { TrendUpIcon, TrendDownIcon, TrendStableIcon, LoadingIcon, DownloadIcon, TagIcon, CheckIcon } from "./ui/Icons";

const GRADE_LABELS = {
  A: "Clean Code",
  B: "Minor Debt",
  C: "High Debt",
  D: "Fragile Code",
  F: "Biohazard",
};

const GRADE_DESCRIPTIONS = {
  A: "Excellent code health. Minimal technical debt detected.",
  B: "Good overall health. Some minor issues to address.",
  C: "Moderate technical debt. Consider refactoring key files.",
  D: "Significant debt present. Priority refactoring recommended.",
  F: "Critical code health. Immediate action required.",
};

const TREND_CONFIG = {
  improving: { icon: TrendUpIcon, label: "Trending up", color: "text-semantic-success" },
  declining: { icon: TrendDownIcon, label: "Trending down", color: "text-semantic-error" },
  stable: { icon: TrendStableIcon, label: "Stable", color: "text-text-muted" },
};

function AnimatedCounter({ value, duration = 0.6 }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const num = parseInt(String(value).replace(/[^0-9]/g, "")) || 0;
    if (num === 0) { setDisplay(0); return; }
    const startTime = performance.now();
    let rafId = null;
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(0 + (num - 0) * eased));
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      }
    };
    rafId = requestAnimationFrame(animate);
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [value, duration]);
  const suffix = String(value).replace(/[0-9,.-]/g, "");
  return <>{display.toLocaleString()}{suffix}</>;
}

const SummaryBar = memo(function SummaryBar({ summary, jobId, comparison }) {
  if (!summary) return null;

  const [exporting, setExporting] = useState(false);
  const [copiedBadge, setCopiedBadge] = useState(false);

  const gradeColor = {
    A: "text-grade-a",
    B: "text-grade-b",
    C: "text-grade-c",
    D: "text-grade-d",
    F: "text-grade-f",
  }[summary.grade] || "text-text-primary";

  const trend = comparison?.trend || null;
  const trendConfig = TREND_CONFIG[trend] || null;
  const TrendIcon = trendConfig?.icon || null;

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
    <div className="card-premium overflow-hidden animate-card-enter" role="region" aria-label="Scan summary">
      {/* Hero section */}
      <div className="px-6 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Grade hero — bounce entrance animation */}
          <div className="flex items-center gap-4 shrink-0">
            <div
              className={`text-display-lg font-bold font-display leading-none ${gradeColor} animate-grade-bounce`}
              key={summary.grade}
            >
              {summary.grade}
            </div>
            <div>
              <p className="text-base sm:text-lg font-semibold text-text-primary">
                {GRADE_LABELS[summary.grade] || ""}
              </p>
              <p className="text-xs sm:text-sm text-text-muted mt-0.5 max-w-xs">
                {GRADE_DESCRIPTIONS[summary.grade] || ""}
              </p>
              <p className="text-xs text-text-muted mt-1 font-mono">
                Score: <span className="font-bold text-text-primary">{summary.average_score}</span>/100
                {TrendIcon && (
                  <span className={`ml-3 inline-flex items-center gap-1 ${trendConfig.color}`}>
                    <TrendIcon size={16} />
                    {trendConfig.label}
                    {comparison && (
                      <span className="ml-1 font-mono">
                        ({comparison.score_diff > 0 ? "+" : ""}{comparison.score_diff})
                      </span>
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Metrics — cascade entrance */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 animate-metric-enter">
            <MetricBox
              label="Files"
              value={<AnimatedCounter value={summary.total_files || 0} />}
              sub={summary.files_skipped > 0 ? `${summary.files_skipped} skipped` : null}
            />
            <MetricBox
              label="Lines of Code"
              value={<AnimatedCounter value={summary.total_lines || 0} />}
            />
            <MetricBox
              label="Issues Found"
              value={<AnimatedCounter value={summary.total_violations || 0} />}
              highlight={summary.total_violations > 0}
            />
            <MetricBox
              label="Scan Time"
              value={`${summary.scan_time_seconds?.toFixed(1) || 0}s`}
              sub={`${summary.workers_used} workers`}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-center">
            <button
              onClick={handleExport}
              disabled={exporting || !jobId}
              className="btn-secondary btn-sm btn-magnetic"
              title="Download a self-contained HTML report"
              aria-busy={exporting}
              aria-label={exporting ? "Exporting report..." : "Download HTML report"}
            >
              {exporting ? <LoadingIcon size={14} /> : <DownloadIcon size={14} />}
              <span className="hidden sm:inline">{exporting ? "Exporting..." : "Export"}</span>
            </button>
            <button
              onClick={handleCopyBadge}
              disabled={!jobId}
              className="btn-secondary btn-sm btn-magnetic"
              title="Copy a Markdown badge for your README"
              aria-label={copiedBadge ? "Badge copied to clipboard" : "Copy badge markdown for README"}
            >
              {copiedBadge ? <CheckIcon size={14} className="text-semantic-success" /> : <TagIcon size={14} />}
              <span className="hidden sm:inline">{copiedBadge ? "Copied" : "Badge"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grade distribution bar */}
      {summary.grade_distribution && (
        <div className="px-6 sm:px-8 py-3 bg-surface-0/30 border-t border-surface-3">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-eyebrow text-text-muted">Grade distribution:</span>
            <div className="flex items-center gap-1.5">
              {["A", "B", "C", "D", "F"].map((g) => {
                const count = summary.grade_distribution[g] || 0;
                if (count === 0) return null;
                return (
                  <span key={g} className="badge-grade bg-surface-3 text-text-secondary">
                    <span className={
                      g === "A" ? "text-grade-a" :
                      g === "B" ? "text-grade-b" :
                      g === "C" ? "text-grade-c" :
                      g === "D" ? "text-grade-d" :
                      "text-grade-f"
                    }>{g}</span>
                    <span className="text-text-muted ml-0.5">{count}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Violations by type */}
      {summary.violations_by_type &&
        Object.keys(summary.violations_by_type).length > 0 && (
          <div className="px-6 sm:px-8 py-3 border-t border-surface-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-eyebrow text-text-muted">Issues by type:</span>
              {Object.entries(summary.violations_by_type).map(([type, count]) => (
                <span
                  key={type}
                  className={`badge ${
                    type === "max_nesting"
                      ? "bg-grade-f/15 text-grade-f"
                      : type === "magic_number"
                      ? "bg-grade-c/15 text-grade-c"
                      : type === "todo"
                      ? "bg-grade-b/15 text-grade-b"
                      : "bg-surface-3 text-text-muted"
                  }`}
                >
                  {type === "max_nesting"
                    ? "Nesting"
                    : type === "magic_number"
                    ? "Magic #"
                    : type === "todo"
                    ? "TODOs"
                    : type}
                  : <span className="font-bold ml-0.5">{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
    </div>
  );
});

const MetricBox = memo(function MetricBox({ label, value, sub, highlight }) {
  return (
    <div className="text-center sm:text-left">
      <p className={`text-xl sm:text-2xl font-mono font-bold ${
        highlight ? "text-semantic-warning" : "text-text-primary"
      }`}>
        {value}
      </p>
      <p className="text-caption text-text-muted">{label}</p>
      {sub && <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>}
    </div>
  );
});

export default SummaryBar;
