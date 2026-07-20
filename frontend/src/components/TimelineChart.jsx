/**
 * TimelineChart — Gráfico de evolución del score a lo largo de commits.
 * Usa icono SVG en lugar de emoji.
 */

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { HistoryIcon } from "./ui/Icons";

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  } catch {
    return dateStr?.slice(5, 10) || "?";
  }
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="tooltip-content max-w-xs">
      <p className="font-mono text-text-primary text-xs truncate" title={d.message}>{d.message}</p>
      <div className="flex items-center gap-2 pt-1">
        <span className={`badge-grade ${
          d.grade === "A" ? "badge-a" :
          d.grade === "B" ? "badge-b" :
          d.grade === "C" ? "badge-c" :
          d.grade === "D" ? "badge-d" :
          "badge-f"
        }`}>{d.grade}</span>
        <span className="text-text-secondary text-xs">
          Score: <span className="font-mono font-bold">{d.score}</span>
        </span>
      </div>
      <p className="text-text-muted text-[10px] pt-0.5">{d.author} · {d.hash}</p>
    </div>
  );
}

const GRADE_LINES = [
  { y: 90, color: "#22c55e", opacity: 0.15 },
  { y: 75, color: "#84cc16", opacity: 0.15 },
  { y: 60, color: "#f59e0b", opacity: 0.15 },
  { y: 40, color: "#f97316", opacity: 0.15 },
];

export default function TimelineChart({ commits }) {
  if (!commits?.length) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <HistoryIcon size={16} className="text-text-muted" />
          <h3 className="section-header">Score Evolution</h3>
        </div>
        <p className="text-text-muted text-xs">No commit data available.</p>
      </div>
    );
  }

  const data = commits
    .filter((c) => c.score != null)
    .reverse()
    .map((c) => ({
      ...c,
      label: formatDate(c.date),
    }));

  if (data.length < 2) {
    return (
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-2">
          <HistoryIcon size={16} className="text-text-muted" />
          <h3 className="section-header">Score Evolution</h3>
        </div>
        <p className="text-text-muted text-xs">
          At least 2 commits with score data are needed to show the evolution chart.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <HistoryIcon size={16} className="text-text-muted" />
          <div>
            <h3 className="section-header">Score Evolution</h3>
            <p className="text-caption text-text-muted mt-0.5">
              {data.length} commits analyzed
            </p>
          </div>
        </div>
      </div>

      <div className="card-premium p-4">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis
              dataKey="label"
              tick={{ fill: "#71717a", fontSize: 10 }}
              axisLine={{ stroke: "#222228" }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fill: "#71717a", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            {GRADE_LINES.map(({ y, color, opacity }) => (
              <ReferenceLine
                key={y}
                y={y}
                stroke={color}
                strokeDasharray="3 3"
                strokeOpacity={opacity}
              />
            ))}
            <Line
              type="monotone"
              dataKey="score"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: "#6366f1", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#818cf8" }}
              animationDuration={500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Grade legend */}
      <div className="mt-3 flex items-center gap-4 text-[10px] text-text-muted">
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded bg-grade-a/40" /> A (90+)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded bg-grade-b/40" /> B (75+)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded bg-grade-c/40" /> C (60+)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded bg-grade-d/40" /> D (40+)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-0.5 rounded bg-grade-f/40" /> F (&lt;40)</span>
      </div>
    </div>
    </div>
  );
}
