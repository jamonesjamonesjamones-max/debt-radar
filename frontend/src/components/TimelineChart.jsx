/**
 * TimelineChart — Gráfico de evolución del score a lo largo de commits.
 */

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

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
    <div className="bg-surface-1 border border-surface-3 rounded-md px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="font-mono text-text-primary">{d.message}</p>
      <p className="text-text-secondary">
        Score: <span className="font-mono font-bold">{d.score}</span> ({d.grade})
      </p>
      <p className="text-text-muted">{d.author} · {d.hash}</p>
    </div>
  );
}

export default function TimelineChart({ commits }) {
  if (!commits?.length) return null;

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
        <h3 className="text-sm font-medium text-text-secondary mb-4">
          🕐 Time Machine — Commit History
        </h3>
        <p className="text-text-muted text-xs">At least 2 commits with score are needed to show the chart.</p>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h3 className="text-sm font-medium text-text-secondary mb-4">
        🕐 Time Machine — Score Evolution
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="label" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 10 }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.3} />
            <ReferenceLine y={75} stroke="#84cc16" strokeDasharray="3 3" strokeOpacity={0.3} />
            <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.3} />
            <ReferenceLine y={40} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.3} />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: "#6366f1", r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex items-center gap-4 text-[10px] text-text-muted">
        <span>🟢 A (90+)</span>
        <span>🟡 B (75+)</span>
        <span>🟠 C (60+)</span>
        <span>🔴 D (40+)</span>
        <span>⚫ F (&lt;40)</span>
      </div>
    </div>
  );
}
