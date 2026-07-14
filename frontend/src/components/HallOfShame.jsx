/**
 * HallOfShame — Tabla de archivos más problemáticos, ordenados por score ascendente.
 *
 * Nota de performance: la tabla se pagina en el cliente (PAGE_SIZE filas por vez)
 * para repos grandes. Renderizar miles de filas de golpe (cada una con varios nodos
 * DOM para las "violation pills") puede congelar o crashear la pestaña justo cuando
 * el escaneo termina — el síntoma reportado era una pantalla en negro al completar.
 */

import { useState } from "react";
import { shortenPath } from "../utils/paths";

const PAGE_SIZE = 50;

const SCORE_BG = {
  A: "bg-grade-a/15 text-grade-a",
  B: "bg-grade-b/15 text-grade-b",
  C: "bg-grade-c/15 text-grade-c",
  D: "bg-grade-d/15 text-grade-d",
  F: "bg-grade-f/15 text-grade-f",
};

function getGrade(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export default function HallOfShame({ files, onSelect }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (!files?.length) return null;

  // Ordenar por score ascendente (peores primero)
  const sorted = [...files].sort((a, b) => a.score - b.score);
  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-text-secondary">
          Hall of Shame — Most problematic files
        </h3>
        <span className="text-xs text-text-muted">
          Showing {visible.length} of {sorted.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-surface-3 text-left">
              <th className="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                #
              </th>
              <th className="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                File
              </th>
              <th className="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right">
                Lines
              </th>
              <th className="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-center">
                Grade
              </th>
              <th className="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider text-right">
                Score
              </th>
              <th className="px-5 py-3 text-xs font-medium text-text-muted uppercase tracking-wider">
                Issues
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((file, i) => {
              const grade = getGrade(file.score);
              const gradeStyle = SCORE_BG[grade] || "";
              const violationCount = file.violations?.length || 0;

              return (
                <tr
                  key={file.path}
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
                             hover:bg-surface-3/30 cursor-pointer transition-colors
                             focus:outline-none focus:bg-surface-3/40"
                >
                  <td className="px-5 py-3 text-text-muted font-mono text-xs">
                    {i + 1}
                  </td>
                  <td className="px-5 py-3 align-top">
                    <span
                      className="font-mono text-text-primary text-xs break-all block min-w-[16rem] max-w-xl"
                      title={file.path}
                    >
                      {shortenPath(file.path, 4)}
                    </span>
                    {shortenPath(file.path, 4) !== file.path && (
                      <span className="mt-1 block max-w-xl break-all font-mono text-[10px] leading-relaxed text-text-muted">
                        {file.path}
                      </span>
                    )}
                    <span className="mt-1 block text-[10px] text-text-muted">{file.language}</span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-text-secondary">
                    {file.lines.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-bold font-mono ${gradeStyle}`}
                    >
                      {grade}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-mono font-bold text-text-primary">
                      {file.score}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {violationCount > 0 && (
                        <ViolationPills violations={file.violations} />
                      )}
                      <span className="text-text-muted text-xs">
                        {violationCount}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="px-5 py-3 border-t border-surface-3 text-center">
          <button
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
            className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
          >
            Load {Math.min(PAGE_SIZE, sorted.length - visibleCount)} more files
            ({sorted.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

function ViolationPills({ violations }) {
  // Contar por tipo
  const counts = {};
  for (const v of violations) {
    counts[v.type] = (counts[v.type] || 0) + 1;
  }

  const pills = [];
  if (counts.max_nesting)
    pills.push(
      <span
        key="nesting"
        className="px-1.5 py-0.5 rounded text-[10px] bg-grade-f/15 text-grade-f font-mono"
      >
        nesting:{counts.max_nesting}
      </span>
    );
  if (counts.magic_number)
    pills.push(
      <span
        key="magic"
        className="px-1.5 py-0.5 rounded text-[10px] bg-grade-c/15 text-grade-c font-mono"
      >
        magic:{counts.magic_number}
      </span>
    );
  if (counts.todo)
    pills.push(
      <span
        key="todo"
        className="px-1.5 py-0.5 rounded text-[10px] bg-grade-b/15 text-grade-b font-mono"
      >
        todo:{counts.todo}
      </span>
    );

  return <>{pills}</>;
}
