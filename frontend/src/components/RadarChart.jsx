/**
 * RadarChart â€” GrÃ¡fico radar con 4 dimensiones normalizadas (0-100).
 * Muestra Complejidad, TODOs, Magic Numbers y Archivos Dios.
 */

import InfoTooltip from "./ui/InfoTooltip";
import { useMemo } from "react";
import {
  Radar,
  RadarChart as RechartRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

function computeDimensions(files) {
  if (!files?.length) return [];

  const total = files.length;

  const complexityAvg =
    files.reduce((sum, f) => {
      const c = f.deductions?.complexity || 0;
      return sum + Math.abs(c);
    }, 0) / total;
  const complexity = Math.min(Math.round((complexityAvg / 30) * 100), 100);

  const todosAvg =
    files.reduce((sum, f) => {
      const t = f.deductions?.todos || 0;
      return sum + Math.abs(t);
    }, 0) / total;
  const todos = Math.min(Math.round((todosAvg / 20) * 100), 100);

  const magicAvg =
    files.reduce((sum, f) => {
      const m = f.deductions?.magic_numbers || 0;
      return sum + Math.abs(m);
    }, 0) / total;
  const magicNumbers = Math.min(Math.round((magicAvg / 25) * 100), 100);

  const godFiles = files.filter((f) => f.lines > 500).length;
  const godRatio = Math.round((godFiles / total) * 100);

  return [
    { dimension: "Complexity", value: complexity, fullMark: 100 },
    { dimension: "TODOs", value: todos, fullMark: 100 },
    { dimension: "Magic Numbers", value: magicNumbers, fullMark: 100 },
    { dimension: "God Files", value: godRatio, fullMark: 100 },
  ];
}

const METRIC_DESCRIPTIONS = {
  Complexity: "Cyclomatic complexity and nesting depth",
  TODOs: "Accumulated TODOs, FIXMEs and HACKs",
  "Magic Numbers": "Hard-coded literals without context",
  "God Files": "Files exceeding 500 lines",
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="tooltip-content max-w-[200px]">
      <p className="text-text-primary font-medium text-xs">{d.dimension}</p>
      <p className="text-text-muted text-[10px] pt-0.5">{METRIC_DESCRIPTIONS[d.dimension] || ""}</p>
      <p className="font-mono text-accent font-bold text-xs pt-1">
        {d.value}/100
      </p>
    </div>
  );
}

export default function RadarChartComponent({ files }) {
  const radarData = useMemo(() => computeDimensions(files), [files]);

  if (!radarData.length) {
    return (
      <div className="card-premium p-5 h-full flex flex-col">
        <h3 className="section-header mb-1 flex items-center gap-1.5">Debt Radar <InfoTooltip text="Four dimensions of technical debt measured from 0–100. Lower is better. Complex code, accumulated TODOs, magic numbers, and oversized files all hurt maintainability." side="bottom" /></h3>
        <p className="text-text-muted text-xs">No data available.</p>
      </div>
    );
  }

  return (
    <div className="card-premium p-5 h-full flex flex-col">
      <h3 className="section-header mb-1 flex items-center gap-1.5">Debt Radar <InfoTooltip text="Four dimensions of technical debt measured from 0–100. Lower is better. Complex code, accumulated TODOs, magic numbers, and oversized files all hurt maintainability." side="bottom" /></h3>
      <p className="text-caption text-text-muted mb-4">
        {radarData.length} dimensions measured
      </p>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RechartRadar data={radarData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#2a2a32" strokeOpacity={0.6} />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: "#a1a1aa", fontSize: 10 }}
              tickLine={false}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "#71717a", fontSize: 8 }}
              axisLine={false}
              tickCount={4}
            />
            <Radar
              dataKey="value"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.2}
              strokeWidth={2}
              animationDuration={500}
              activeDot={{ r: 4, fill: "#818cf8" }}
            />
            <Tooltip content={<CustomTooltip />} />
          </RechartRadar>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
