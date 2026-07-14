/**
 * RadarChart — Gráfico radar con 4 dimensiones: Complejidad, TODOs, Magic Numbers, Archivos Dios.
 */

import {
  Radar,
  RadarChart as RechartRadar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

/**
 * Calcula las 4 dimensiones normalizadas (0-100) a partir de los archivos.
 * Cada dimensión representa qué tan grave es el problema en el repo.
 */
function computeDimensions(files) {
  if (!files?.length) return [];

  const total = files.length;

  // 1. Complejidad: promedio de (100 - score) de deducciones de complejidad
  const complexityAvg =
    files.reduce((sum, f) => {
      const c = f.deductions?.complexity || 0;
      return sum + Math.abs(c);
    }, 0) / total;
  const complexity = Math.min(Math.round((complexityAvg / 30) * 100), 100);

  // 2. TODOs: promedio de deducción de TODOs
  const todosAvg =
    files.reduce((sum, f) => {
      const t = f.deductions?.todos || 0;
      return sum + Math.abs(t);
    }, 0) / total;
  const todos = Math.min(Math.round((todosAvg / 20) * 100), 100);

  // 3. Magic Numbers: promedio de deducción de magic numbers
  const magicAvg =
    files.reduce((sum, f) => {
      const m = f.deductions?.magic_numbers || 0;
      return sum + Math.abs(m);
    }, 0) / total;
  const magicNumbers = Math.min(Math.round((magicAvg / 25) * 100), 100);

  // 4. Archivos Dios: % de archivos con >500 líneas
  const godFiles = files.filter((f) => f.lines > 500).length;
  const godRatio = Math.round((godFiles / total) * 100);

  return [
    { dimension: "Complexity", value: complexity, fullMark: 100 },
    { dimension: "TODOs", value: todos, fullMark: 100 },
    { dimension: "Magic Numbers", value: magicNumbers, fullMark: 100 },
    { dimension: "God Files", value: godRatio, fullMark: 100 },
  ];
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="bg-surface-1 border border-surface-3 rounded-md px-3 py-2 shadow-lg text-xs">
      <p className="text-text-primary font-medium">{d.dimension}</p>
      <p className="font-mono text-accent font-bold">{d.value}/100</p>
    </div>
  );
}

export default function RadarChartComponent({ files }) {
  const radarData = computeDimensions(files);

  if (!radarData.length) return null;

  return (
    <div className="card p-5 h-full flex flex-col">
      <h3 className="text-sm font-medium text-text-secondary mb-4">
        Technical Debt Radar
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RechartRadar data={radarData} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke="#2a2a32" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "#71717a", fontSize: 9 }}
              axisLine={false}
            />
            <Radar
              dataKey="value"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.25}
              strokeWidth={2}
              animationDuration={500}
            />
            <Tooltip content={<CustomTooltip />} />
          </RechartRadar>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
