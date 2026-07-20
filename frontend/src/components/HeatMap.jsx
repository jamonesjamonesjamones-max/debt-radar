/**
 * HeatMap — Treemap de Recharts con colores semánticos según score.
 */

import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { shortenPath } from "../utils/paths";
import InfoTooltip from "./ui/InfoTooltip";

const SCORE_COLORS = [
  { min: 90, max: 100, fill: "#22c55e", grade: "A" },
  { min: 75, max: 89,  fill: "#84cc16", grade: "B" },
  { min: 60, max: 74,  fill: "#f59e0b", grade: "C" },
  { min: 40, max: 59,  fill: "#f97316", grade: "D" },
  { min: 0,  max: 39,  fill: "#ef4444", grade: "F" },
];

function getColor(score) {
  for (const range of SCORE_COLORS) {
    if (score >= range.min && score <= range.max) return range;
  }
  return { fill: "#ef4444", grade: "F" };
}

function CustomContent({ x, y, width, height, name, score, lines }) {
  if (width < 4 || height < 4) return null;
  if (!name) return null;

  const { fill, grade } = getColor(score);
  const showLabel = width > 60 && height > 35;
  const showScore = width > 45 && height > 25;
  const shortName = shortenPath(name, width > 120 ? 3 : 2);

  return (
    <g>
      <title>{name}</title>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={4}
        fill={fill}
        fillOpacity={0.85}
        stroke="#0a0a0c"
        strokeWidth={1.5}
      />
      {/* Subtle inner border for depth */}
      <rect
        x={x + 1}
        y={y + 1}
        width={width - 2}
        height={height - 2}
        rx={3}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={0.5}
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
      {/* Grade letter when small */}
      {!showLabel && score != null && width > 30 && height > 20 && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 4}
          fill="#fff"
          fontSize={14}
          fontWeight={700}
          fontFamily="JetBrains Mono, monospace"
          fillOpacity={0.9}
          textAnchor="middle"
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
        >
          {grade}
        </text>
      )}
    </g>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const { fill, grade } = getColor(d.score);

  return (
    <div className="tooltip-content max-w-sm">
      <p className="font-mono text-text-primary break-all text-xs">{d.name}</p>
      <div className="flex items-center gap-3 pt-1">
        <span className="badge-grade" style={{ backgroundColor: fill + "20", color: fill }}>
          {grade}
        </span>
        <span className="text-text-secondary text-xs">
          Score: <span className="font-mono font-bold" style={{ color: fill }}>{d.score}</span>/100
        </span>
      </div>
      <p className="text-text-muted text-[10px]">{d.lines?.toLocaleString()} lines</p>
    </div>
  );
}

const MAX_TREEMAP_FILES = 300;

export default function HeatMap({ files, onSelect }) {
  if (!files?.length) return null;

  const isTruncated = files.length > MAX_TREEMAP_FILES;
  const displayFiles = isTruncated
    ? [...files].sort((a, b) => b.lines - a.lines).slice(0, MAX_TREEMAP_FILES)
    : files;

  const treeData = displayFiles.map((f) => ({
    name: f.path,
    size: Math.max(f.lines, 10),
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
    <div className="card-premium overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-3">
        <div className="flex items-center justify-between">
          <h3 className="section-header flex items-center gap-1.5">Heat Map <InfoTooltip text="Each rectangle is a file. Size = lines of code, Color = health grade (A=green, F=red). Click any file to inspect its violations." /></h3>
          {isTruncated && (
            <span className="text-eyebrow text-text-muted">
              Showing {MAX_TREEMAP_FILES} of {files.length}
            </span>
          )}
        </div>
        <p className="text-caption text-text-muted mt-0.5">
          Size by lines · Color by score
        </p>
      </div>

      {/* Legend */}
      {/* Legend */}
      <div className="px-5 py-2.5 flex items-center gap-3 border-b border-surface-3 bg-surface-0/20" role="list" aria-label="Grade color legend">
        {SCORE_COLORS.map(({ fill, grade, min, max }) => (
          <span key={grade} className="flex items-center gap-1.5 text-[10px] text-text-muted" role="listitem">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: fill }} aria-hidden="true" />
            {grade} ({min}-{max})
          </span>
        ))}
      </div>

      <div className="p-5">
        <div className="h-72 sm:h-80" role="img" aria-label={`Treemap of ${files.length} files colored by health grade`}>
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
    </div>
  );
}
