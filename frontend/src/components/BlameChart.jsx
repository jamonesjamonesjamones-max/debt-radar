/**
 * BlameChart — Horizontal bar chart showing debt by author.
 */

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e", "#6366f1", "#8b5cf6"];

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="bg-surface-1 border border-surface-3 rounded-md px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="font-medium text-text-primary">{d.author}</p>
      <p className="text-text-secondary">
        Violations: <span className="font-mono font-bold">{d.violations}</span>
      </p>
      <p className="text-text-muted">
        Nesting: {d.by_type?.max_nesting || 0} · Magic: {d.by_type?.magic_number || 0} · TODOs: {d.by_type?.todo || 0}
      </p>
      <p className="text-text-muted">{d.files_count} files</p>
    </div>
  );
}

export default function BlameChart({ blameData }) {
  if (!blameData?.authors || Object.keys(blameData.authors).length === 0) {
    return (
      <div className="card p-5">
        <h3 className="text-sm font-medium text-text-secondary mb-4">
          👤 Debt by Author (Git Blame)
        </h3>
        <p className="text-text-muted text-xs">No blame data available.</p>
      </div>
    );
  }

  const data = Object.entries(blameData.authors)
    .slice(0, 10)
    .map(([author, stats]) => ({
      author: author.length > 20 ? author.slice(0, 18) + "…" : author,
      violations: stats.violations,
      files_count: stats.files_count,
      by_type: stats.by_type,
    }));

  return (
    <div className="card p-5">
      <h3 className="text-sm font-medium text-text-secondary mb-4">
        👤 Debt by Author (Git Blame)
      </h3>
      <div style={{ height: Math.max(data.length * 36, 120) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
            <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} />
            <YAxis
              type="category"
              dataKey="author"
              width={120}
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="violations" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {blameData.summary && (
        <p className="text-[10px] text-text-muted mt-2">
          {blameData.summary.total_authors} authors · {blameData.summary.total_violations_attributed} attributed violations
        </p>
      )}
    </div>
  );
}
