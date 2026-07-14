/**
 * ScanHistory — Muestra el historial de escaneos con gráfico de evolución.
 */

import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { API_BASE } from "../api/client";

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr + "Z");
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return dateStr?.slice(5, 16) || "?";
  }
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="bg-surface-1 border border-surface-3 rounded-md px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="font-mono text-text-primary">{formatDate(d.created_at)}</p>
      <p className="text-text-secondary">
        Score: <span className="font-mono font-bold">{d.score}</span> ({d.grade})
      </p>
      <p className="text-text-muted">{d.total_violations} issues</p>
    </div>
  );
}

export default function ScanHistory({ path, comparison }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!path) return;

    setLoading(true);
    fetch(`${API_BASE}/api/scan/history?path=${encodeURIComponent(path)}&limit=10`)
      .then((r) => r.json())
      .then((d) => setHistory(d.history || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [path]);

  // Solo mostrar si hay >= 2 escaneos
  if (loading || history.length < 2) return null;

  const data = [...history].reverse();

  return (
    <div className="space-y-3">
      {/* Banner de comparación */}
      {comparison && (
        <div
          className={`card px-4 py-3 flex items-center gap-3 ${
            comparison.trend === "improving"
              ? "border-grade-a/30"
              : comparison.trend === "declining"
              ? "border-grade-f/30"
              : ""
          }`}
        >
          <span className="text-lg">
            {comparison.trend === "improving"
              ? "📈"
              : comparison.trend === "declining"
              ? "📉"
              : "➡️"}
          </span>
          <div className="flex-1">
            <p className="text-sm text-text-primary">
              {comparison.trend === "improving"
                ? "Improving!"
                : comparison.trend === "declining"
                ? "Declining"
                : "No change"}
            </p>
            <p className="text-xs text-text-muted">
              {comparison.score_diff > 0 ? "+" : ""}
              {comparison.score_diff} points since last scan
              {comparison.violations_diff !== 0 && (
                <span>
                  {" "}
                  · {comparison.violations_diff > 0 ? "+" : ""}
                  {comparison.violations_diff} issues
                </span>
              )}
            </p>
          </div>
          <span className="text-xs text-text-muted font-mono">
            Last: {comparison.last_scan.grade} ({comparison.last_scan.score})
          </span>
        </div>
      )}

      {/* Gráfico de historial */}
      <div className="card p-5">
        <h3 className="text-sm font-medium text-text-secondary mb-4">
          📊 Scan History ({history.length})
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <XAxis
                dataKey="created_at"
                tickFormatter={formatDate}
                tick={{ fill: "#a1a1aa", fontSize: 10 }}
              />
              <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="3 3" strokeOpacity={0.2} />
              <ReferenceLine y={75} stroke="#84cc16" strokeDasharray="3 3" strokeOpacity={0.2} />
              <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="3 3" strokeOpacity={0.2} />
              <ReferenceLine y={40} stroke="#f97316" strokeDasharray="3 3" strokeOpacity={0.2} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: "#6366f1", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
