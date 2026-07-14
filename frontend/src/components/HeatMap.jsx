/**
 * HeatMap — Treemap de Recharts con colores semánticos según score.
 */

import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { shortenPath } from "../utils/paths";

const SCORE_COLORS = [
  { min: 90, max: 100, fill: "#22c55e" },  // A - verde
  { min: 75, max: 89,  fill: "#84cc16" },  // B - lima
  { min: 60, max: 74,  fill: "#f59e0b" },  // C - ámbar
  { min: 40, max: 59,  fill: "#f97316" },  // D - naranja
  { min: 0,  max: 39,  fill: "#ef4444" },  // F - rojo
];

function getColor(score) {
  for (const range of SCORE_COLORS) {
    if (score >= range.min && score <= range.max) return range.fill;
  }
  return "#ef4444";
}

function CustomContent({ x, y, width, height, name, score, lines }) {
  if (width < 4 || height < 4) return null;

  // Recharts invoca este componente para TODOS los nodos del árbol interno del
  // Treemap, incluyendo un nodo raíz invisible que envuelve a todos los
  // archivos. Ese nodo raíz no tiene name/score/lines (son undefined). Sin
  // este guard, "shortName.length" explota apenas el contenedor mide más de
  // 60x35px — es decir, en casi cualquier pantalla real. Si no hay nombre,
  // no es un archivo real: no dibujamos nada.
  if (!name) return null;

  const color = getColor(score);
  const showLabel = width > 60 && height > 35;
  const showScore = width > 45 && height > 25;

  // Conserva carpeta + archivo para distinguir rutas similares en el mapa.
  const shortName = shortenPath(name, width > 120 ? 3 : 2);

  return (
    <g>
      <title>{name}</title>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={3}
        fill={color}
        fillOpacity={0.85}
        stroke="#0a0a0c"
        strokeWidth={1.5}
      />
      {showLabel && (
        <text
          x={x + 6}
          y={y + 16}
          fill="#fff"
          fontSize={10}
          fontWeight={500}
          fontFamily="Inter, sans-serif"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
        >
          {shortName.length > 18
            ? shortName.slice(0, 16) + "…"
            : shortName}
        </text>
      )}
      {showScore && (
        <text
          x={x + 6}
          y={y + height - 8}
          fill="#fff"
          fontSize={11}
          fontWeight={700}
          fontFamily="JetBrains Mono, monospace"
          fillOpacity={0.9}
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
        >
          {score}
        </text>
      )}
    </g>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  return (
    <div className="max-w-md bg-surface-1 border border-surface-3 rounded-md px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="font-mono text-text-primary break-all">{d.name}</p>
      <p className="text-text-secondary">
        Score: <span className="font-mono font-bold" style={{ color: getColor(d.score) }}>{d.score}</span>/100
      </p>
      <p className="text-text-muted">{d.lines?.toLocaleString()} lines</p>
    </div>
  );
}

// Renderizar miles de rects SVG a la vez (repos muy grandes) puede congelar el
// navegador. Si hay más archivos que esto, mostramos solo los más relevantes
// (los de mayor tamaño, donde suele concentrarse la deuda técnica).
const MAX_TREEMAP_FILES = 300;

export default function HeatMap({ files, onSelect }) {
  if (!files?.length) return null;

  const isTruncated = files.length > MAX_TREEMAP_FILES;
  const displayFiles = isTruncated
    ? [...files].sort((a, b) => b.lines - a.lines).slice(0, MAX_TREEMAP_FILES)
    : files;

  // Recharts Treemap espera un array de { name, size, ...rest }
  const treeData = displayFiles.map((f) => ({
    name: f.path,
    size: Math.max(f.lines, 10), // mínimo 10 para que sea visible
    score: f.score,
    lines: f.lines,
    _original: f,
  }));

  const handleClick = (entry) => {
    if (entry?._original) {
      onSelect(entry._original);
    }
  };

  return (
    <div className="card p-5">
      <h3 className="text-sm font-medium text-text-secondary mb-4">
        Heat Map — Size by lines, color by score
        {isTruncated && (
          <span className="text-text-muted font-normal">
            {" "}(showing {MAX_TREEMAP_FILES} largest of {files.length})
          </span>
        )}
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={treeData}
            dataKey="size"
            aspectRatio={4 / 3}
            content={<CustomContent />}
            onClick={handleClick}
            animationDuration={300}
          >
            <Tooltip content={<CustomTooltip />} />
          </Treemap>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
