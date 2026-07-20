/**
 * HallOfShame — Tabla de archivos más problemáticos, ordenados por score ascendente.
 * Rediseñada con filtros por grado, violación pills consistentes y mejor interacción.
 */

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { shortenPath } from "../utils/paths";
import InfoTooltip from "./ui/InfoTooltip";
import StatusPill from "./ui/StatusPill";
import { GradeBadge } from "./ui/Badge";

const PAGE_SIZE = 50;

const GRADE_ORDER = ["F", "D", "C", "B", "A"];
const GRADE_FILTERS = [
  { key: null, label: "All" },
  { key: "F", label: "F" },
  { key: "D", label: "D" },
  { key: "C", label: "C" },
  { key: "B", label: "B" },
  { key: "A", label: "A" },
];

function getGrade(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

function sortByGradeAndScore(files) {
  return [...files].sort((a, b) => {
    const ga = GRADE_ORDER.indexOf(getGrade(a.score));
    const gb = GRADE_ORDER.indexOf(getGrade(b.score));
    if (ga !== gb) return ga - gb;
    return a.score - b.score;
  });
}

export default function HallOfShame({ files, onSelect }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [gradeFilter, setGradeFilter] = useState(null);

  if (!files?.length) return null;

  const sorted = useMemo(() => sortByGradeAndScore(files), [files]);

  const filtered = gradeFilter
    ? sorted.filter((f) => getGrade(f.score) === gradeFilter)
    : sorted;

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Contar por grado para mostrar en filtros (con memo)
  const gradeCounts = useMemo(() => {
    const counts = {};
    for (const f of files) {
      const g = getGrade(f.score);
      counts[g] = (counts[g] || 0) + 1;
    }
    return counts;
  }, [files]);

  return (
    <div className="card-premium overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-3">
        <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3">
          <div>
            <h3 className="section-header flex items-center gap-1.5">
              Hall of Shame <InfoTooltip text="Files ranked by worst score. Red (F) files are the most critical � high complexity, many TODOs, magic numbers, or excessive size. Start refactoring from the top." side="bottom" />
            </h3>
            <p className="text-caption text-text-muted mt-0.5">
              Worst files ranked by technical debt score
            </p>
          </div>
          <span className="text-eyebrow text-text-muted">
            {filtered.length} of {sorted.length} files
          </span>
        </div>

        {/* Grade filter pills */}
        <div className="flex items-center gap-1.5 mt-3 flex-wrap" role="radiogroup" aria-label="Filter by grade">
          {GRADE_FILTERS.map(({ key, label }) => {
            const isActive = gradeFilter === key;
            const count = key ? gradeCounts[key] || 0 : sorted.length;
            return (
              <button
                key={label}
                onClick={() => setGradeFilter(key)}
                role="radio"
                aria-checked={isActive}
                aria-label={`${label === "All" ? "All grades" : `Grade ${label}`}: ${count} files`}
                className={`px-2.5 py-1 rounded-pill text-[10px] font-mono font-medium interactive-transition
                  ${isActive
                    ? key
                      ? `bg-grade-${key.toLowerCase()}-bg text-grade-${key.toLowerCase()}`
                      : "bg-accent/15 text-accent"
                    : "bg-surface-3 text-text-muted hover:bg-surface-4 hover:text-text-secondary"
                  }`}
              >
                {label}
                <span className="ml-1 opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table (desktop) + Cards (mobile) */}
      {/* Desktop table - hidden on small screens */}
      <div className="overflow-x-auto hidden md:block">
        <table className="w-full min-w-[48rem] text-sm" role="table" aria-label="Files ranked by technical debt">
          <thead>
            <tr className="border-b border-surface-3 text-left">
              <th className="table-header table-cell" scope="col" aria-sort="ascending">#</th>
              <th className="table-header table-cell" scope="col">File</th>
              <th className="table-header table-cell text-right" scope="col">Lines</th>
              <th className="table-header table-cell text-center" scope="col">Grade</th>
              <th className="table-header table-cell text-right" scope="col">Score</th>
              <th className="table-header table-cell" scope="col">Issues</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((file, i) => {
              const grade = getGrade(file.score);
              const violationCount = file.violations?.length || 0;

              return (
                <motion.tr
                  key={file.path}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.008, 0.5) }}
                  onClick={() => onSelect(file)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(file);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for ${file.path}`}
                  className="border-b border-surface-3/50 last:border-0
                             hover:bg-surface-3/20 hover:shadow-sm cursor-pointer interactive-transition animate-fade-in
                             focus:outline-none focus:bg-surface-3/30"
                >
                  <td className="table-cell text-text-muted font-mono text-xs">
                    {i + 1}
                  </td>
                  <td className="table-cell align-top">
                    <span
                      className="font-mono text-text-primary text-xs break-all block min-w-[12rem] max-w-md"
                      title={file.path}
                    >
                      {shortenPath(file.path, 4)}
                    </span>
                    {shortenPath(file.path, 4) !== file.path && (
                      <span className="mt-0.5 block max-w-md break-all font-mono text-[10px] leading-relaxed text-text-muted">
                        {file.path}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[10px] text-text-muted">{file.language}</span>
                  </td>
                  <td className="table-cell text-right font-mono text-text-secondary">
                    {file.lines.toLocaleString()}
                  </td>
                  <td className="table-cell text-center">
                    <GradeBadge grade={grade} />
                  </td>
                  <td className="table-cell text-right">
                    <span className="font-mono font-bold text-text-primary">{file.score}</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2 min-w-[100px]">
                      {violationCount > 0 ? (
                        <FileViolationPills violations={file.violations} />
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards - shown only on small screens */}
      <div className="md:hidden divide-y divide-surface-3/50">
        {visible.map((file, i) => {
          const grade = getGrade(file.score);
          const violationCount = file.violations?.length || 0;

          return (
            <motion.div
              key={file.path}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.008, 0.5) }}
              onClick={() => onSelect(file)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(file);
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`View details for ${file.path}`}
              className="px-4 py-4 interactive-transition hover:bg-surface-3/20 cursor-pointer card-lift focus:outline-none focus:bg-surface-3/30 animate-fade-in"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <span className="font-mono text-text-primary text-xs break-all block" title={file.path}>
                    #{i + 1} {shortenPath(file.path, 4)}
                  </span>
                  {shortenPath(file.path, 4) !== file.path && (
                    <span className="mt-0.5 block break-all font-mono text-[10px] leading-relaxed text-text-muted">
                      {file.path}
                    </span>
                  )}
                  <span className="text-[10px] text-text-muted block mt-0.5">{file.language} · {file.lines.toLocaleString()} lines</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <GradeBadge grade={grade} />
                  <span className="font-mono font-bold text-sm text-text-primary">{file.score}</span>
                </div>
              </div>
              {violationCount > 0 ? (
                <FileViolationPills violations={file.violations} />
              ) : (
                <span className="text-text-muted text-[10px]">No issues</span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Pagination */}
      {hasMore && (
        <div className="px-5 py-4 border-t border-surface-3 text-center">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="btn-ghost btn-sm btn-magnetic"
          >
            Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
            <span className="text-text-muted ml-1">({filtered.length - visibleCount} remaining)</span>
          </button>
        </div>
      )}
    </div>
  );
}

function FileViolationPills({ violations }) {
  const counts = {};
  for (const v of violations) {
    counts[v.type] = (counts[v.type] || 0) + 1;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {Object.entries(counts).map(([type, count]) => (
        <StatusPill key={type} type={type} count={count} />
      ))}
    </div>
  );
}
