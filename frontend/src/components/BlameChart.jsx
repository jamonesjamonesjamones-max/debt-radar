/**
 * BlameChart — Horizontal bar chart showing debt by author.
 * Usa icono SVG en lugar de emoji.
 */

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import StatusPill from "./ui/StatusPill";
import { PersonIcon } from "./ui/Icons";

const COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#6366f1", "#8b5cf6", "#ec4899"];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="tooltip-content">
      <p className="font-medium text-text-primary text-xs">{d.author}</p>
      <div className="pt-1 space-y-0.5">
        <p className="text-text-secondary text-xs">
          Violations: <span className="font-mono font-bold">{d.violations}</span>
        </p>
        <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
          {d.by_type?.max_nesting > 0 && (
            <StatusPill type="max_nesting" count={d.by_type.max_nesting} />
          )}
          {d.by_type?.magic_number > 0 && (
            <StatusPill type="magic_number" count={d.by_type.magic_number} />
          )}
          {d.by_type?.todo > 0 && (
            <StatusPill type="todo" count={d.by_type.todo} />
          )}
        </div>
        <p className="text-text-muted text-[10px] pt-0.5">{d.files_count} files</p>
      </div>
    </div>
  );
}

export default function BlameChart({ blameData }) {
  if (!blameData?.authors || Object.keys(blameData.authors).length === 0) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <PersonIcon size={16} className="text-text-muted" />
          <h3 className="section-header">Debt by Author</h3>
        </div>
        <p className="text-text-muted text-xs">No blame data available. Make sure the repository has Git history.</p>
      </div>
    );
  }

  const data = Object.entries(blameData.authors)
    .sort(([, a], [, b]) => b.violations - a.violations)
    .slice(0, 10)
    .map(([author, stats]) => ({
      author: author.length > 22 ? author.slice(0, 20) + "…" : author,
      violations: stats.violations,
      files_count: stats.files_count,
      by_type: stats.by_type,
      _fullName: author,
    }));

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <PersonIcon size={16} className="text-text-muted" />
        <div>
          <h3 className="section-header">Debt by Author</h3>
          <p className="text-caption text-text-muted mt-0.5">
            Top 10 contributors by attributed violations
          </p>
        </div>
      </div>

      <div style={{ height: Math.max(data.length * 40, 120) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }} barCategoryGap="20%">
            <XAxis
              type="number"
              tick={{ fill: "#71717a", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="author"
              width={130}
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="violations" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {blameData.summary && (
        <div className="mt-4 pt-3 border-t border-surface-3 flex items-center gap-4 text-[10px] text-text-muted">
          <span>{blameData.summary.total_authors} authors</span>
          <span className="w-1 h-1 rounded-full bg-surface-4" />
          <span>{blameData.summary.total_violations_attributed} attributed violations</span>
        </div>
      )}
    </div>
  );
}
