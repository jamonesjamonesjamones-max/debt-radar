/**
 * ScanHistory — Historial de escaneos con gráfico de evolución y banner de comparación.
 * Usa iconos SVG para indicadores de tendencia y chart.
 */

import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { API_BASE } from "../api/client";
import { ChartIcon, TrendUpIcon, TrendDownIcon, TrendStableIcon } from "./ui/Icons";

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
    <div className="tooltip-content">
      <p className="font-mono text-text-primary text-xs">{formatDate(d.created_at)}</p>
      <p className="text-text-secondary text-xs">
        Score: <span className="font-mono font-bold">{d.score}</span> ({d.grade})
      </p>
      <p className="text-text-muted text-[10px]">{d.total_violations} issues</p>
    </div>
  );
}

const GRADE_LINES = [
  { y: 90, color: "#22c55e", label: "A" },
  { y: 75, color: "#84cc16", label: "B" },
  { y: 60, color: "#f59e0b", label: "C" },
  { y: 40, color: "#f97316", label: "D" },
];

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

  if (loading) return null;

  const data = [...history].reverse();
  const showChart = data.length >= 2;

  // Trend icon config
  const trendIconMap = {
    improving: { icon: TrendUpIcon, color: "text-semantic-success" },
    declining: { icon: TrendDownIcon, color: "text-semantic-error" },
    stable: { icon: TrendStableIcon, color: "text-text-muted" },
  };
  const TrendIcon = comparison ? trendIconMap[comparison.trend]?.icon : null;

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Banner de comparación */}
      {comparison && (
        <div
          className={`card px-5 py-4 flex items-center gap-4 ${
            comparison.trend === "improving"
              ? "border-l-2 border-l-semantic-success"
              : comparison.trend === "declining"
              ? "border-l-2 border-l-semantic-error"
              : "border-l-2 border-l-text-muted"
          }`}
          role="status"
          aria-label={`Trend: ${comparison.trend}. Score changed by ${comparison.score_diff} points.`}
        >
          {TrendIcon && (
            <span className={`${trendIconMap[comparison.trend]?.color || "text-text-muted"}`} aria-hidden="true">
              <TrendIcon size={24} />
            </span>
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-text-primary">
                {comparison.trend === "improving"
                  ? "Improving"
                  : comparison.trend === "declining"
                  ? "Declining"
                  : "Stable"}
              </p>
              <span className={`text-xs font-mono font-bold ${
                comparison.score_diff > 0 ? "text-semantic-success" : comparison.score_diff < 0 ? "text-semantic-error" : "text-text-muted"
              }`}>
                {comparison.score_diff > 0 ? "+" : ""}{comparison.score_diff} pts
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {comparison.violations_diff > 0
                ? `${comparison.violations_diff} more issues`
                : comparison.violations_diff < 0
                ? `${Math.abs(comparison.violations_diff)} fewer issues`
                : "Same number of issues"}{" "}
              vs last scan
            </p>
          </div>
          <span className="text-xs text-text-muted font-mono shrink-0">
            Last: {comparison.last_scan?.grade} ({comparison.last_scan?.score})
          </span>
        </div>
      )}

      {/* Gráfico de historial */}
      {showChart && (
        <div className="card-premium p-5 animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
          <div className="flex items-center gap-2 mb-4">
            <ChartIcon size={16} className="text-text-muted" />
            <h3 className="section-header">
              Score History ({history.length} scans)
            </h3>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <XAxis
                  dataKey="created_at"
                  tickFormatter={formatDate}
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
                {GRADE_LINES.map(({ y, color }) => (
                  <ReferenceLine
                    key={y}
                    y={y}
                    stroke={color}
                    strokeDasharray="3 3"
                    strokeOpacity={0.2}
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
      )}
    </div>
  );
}
