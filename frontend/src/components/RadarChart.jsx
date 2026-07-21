/**
 * RadarChart — Gráfico radar con 4 dimensiones normalizadas (0-100).
 * Dibujado con SVG puro, sin Recharts ni ResponsiveContainer.
 * Esto evita el bug de ResizeObserver/height=0 que causaba pantalla negra.
 */

import { useMemo, useState } from "react";
import InfoTooltip from "./ui/InfoTooltip";

function computeDimensions(files) {
  if (!files?.length) return [];

  const total = files.length;

  const complexityAvg =
    files.reduce((sum, f) => sum + Math.abs(f.deductions?.complexity || 0), 0) / total;
  const complexity = Math.min(Math.round((complexityAvg / 30) * 100), 100);

  const todosAvg =
    files.reduce((sum, f) => sum + Math.abs(f.deductions?.todos || 0), 0) / total;
  const todos = Math.min(Math.round((todosAvg / 20) * 100), 100);

  const magicAvg =
    files.reduce((sum, f) => sum + Math.abs(f.deductions?.magic_numbers || 0), 0) / total;
  const magicNumbers = Math.min(Math.round((magicAvg / 25) * 100), 100);

  const godFiles = files.filter((f) => f.lines > 500).length;
  const godRatio = Math.round((godFiles / total) * 100);

  return [
    { label: "Complexity",    value: complexity,   desc: "Cyclomatic complexity and nesting depth" },
    { label: "TODOs",         value: todos,         desc: "Accumulated TODOs, FIXMEs and HACKs" },
    { label: "Magic Numbers", value: magicNumbers,  desc: "Hard-coded literals without context" },
    { label: "God Files",     value: godRatio,      desc: "Files exceeding 500 lines" },
  ];
}

const SIZE   = 260;   // SVG viewport
const CX     = SIZE / 2;
const CY     = SIZE / 2;
const RADIUS = 100;   // outer ring radius in SVG units
const LEVELS = 4;     // concentric rings

// Convert polar (angle in radians, r) → SVG cartesian from center
function polar(angleDeg, r) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad),
  };
}

function pointsString(values) {
  return values
    .map((v, i) => {
      const angle = (360 / values.length) * i;
      const r = (v / 100) * RADIUS;
      const p = polar(angle, r);
      return `${p.x},${p.y}`;
    })
    .join(" ");
}

export default function RadarChartComponent({ files }) {
  const dims = useMemo(() => computeDimensions(files), [files]);
  const [hovered, setHovered] = useState(null);

  if (!dims.length) {
    return (
      <div className="card-premium p-5 flex flex-col" style={{ minHeight: 320 }}>
        <h3 className="section-header mb-1 flex items-center gap-1.5">
          Debt Radar{" "}
          <InfoTooltip
            text="Four dimensions of technical debt measured from 0–100. Lower is better."
            side="bottom"
          />
        </h3>
        <p className="text-text-muted text-xs">No data available.</p>
      </div>
    );
  }

  const n      = dims.length;
  const angles = dims.map((_, i) => (360 / n) * i);

  // Label positions — pushed slightly beyond the outer ring
  const labelRadius = RADIUS + 22;

  return (
    <div className="card-premium p-5 flex flex-col" style={{ minHeight: 320 }}>
      <h3 className="section-header mb-1 flex items-center gap-1.5">
        Debt Radar{" "}
        <InfoTooltip
          text="Four dimensions of technical debt measured from 0–100. Lower is better. Complex code, accumulated TODOs, magic numbers, and oversized files all hurt maintainability."
          side="bottom"
        />
      </h3>
      <p className="text-caption text-text-muted mb-3">
        {n} dimensions measured
      </p>

      <div className="flex-1 flex items-center justify-center">
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ overflow: "visible" }}
          aria-label="Debt radar chart"
          role="img"
        >
          {/* Concentric rings */}
          {Array.from({ length: LEVELS }).map((_, l) => {
            const r = (RADIUS / LEVELS) * (l + 1);
            return (
              <circle
                key={l}
                cx={CX}
                cy={CY}
                r={r}
                fill="none"
                stroke="#2a2a32"
                strokeOpacity={0.6}
                strokeWidth={1}
              />
            );
          })}

          {/* Axis lines */}
          {angles.map((angle, i) => {
            const outer = polar(angle, RADIUS);
            return (
              <line
                key={i}
                x1={CX}
                y1={CY}
                x2={outer.x}
                y2={outer.y}
                stroke="#2a2a32"
                strokeOpacity={0.6}
                strokeWidth={1}
              />
            );
          })}

          {/* Filled polygon */}
          <polygon
            points={pointsString(dims.map((d) => d.value))}
            fill="#6366f1"
            fillOpacity={0.2}
            stroke="#6366f1"
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {/* Data points */}
          {dims.map((d, i) => {
            const p = polar(angles[i], (d.value / 100) * RADIUS);
            return (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={hovered === i ? 5 : 3.5}
                fill={hovered === i ? "#818cf8" : "#6366f1"}
                stroke="#0a0a0c"
                strokeWidth={1}
                style={{ cursor: "pointer", transition: "r 0.15s" }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}

          {/* Axis labels */}
          {dims.map((d, i) => {
            const p      = polar(angles[i], labelRadius);
            const anchor = p.x < CX - 4 ? "end" : p.x > CX + 4 ? "start" : "middle";
            return (
              <text
                key={i}
                x={p.x}
                y={p.y}
                textAnchor={anchor}
                dominantBaseline="central"
                fontSize={10}
                fill={hovered === i ? "#e4e4e7" : "#a1a1aa"}
                style={{ transition: "fill 0.15s" }}
              >
                {d.label}
              </text>
            );
          })}

          {/* Hover tooltip */}
          {hovered !== null && (() => {
            const d = dims[hovered];
            const p = polar(angles[hovered], (d.value / 100) * RADIUS);
            // Position tooltip so it doesn't go off-screen
            const tx = p.x > CX ? p.x - 80 : p.x + 8;
            const ty = p.y > CY ? p.y - 48 : p.y + 8;
            return (
              <g>
                <rect
                  x={tx}
                  y={ty}
                  width={76}
                  height={40}
                  rx={4}
                  fill="#1c1c22"
                  stroke="rgba(99,102,241,0.3)"
                  strokeWidth={1}
                />
                <text x={tx + 8} y={ty + 14} fontSize={9} fill="#a1a1aa">
                  {d.label}
                </text>
                <text x={tx + 8} y={ty + 28} fontSize={11} fill="#818cf8" fontWeight="bold" fontFamily="monospace">
                  {d.value}/100
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
        {dims.map((d, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[10px] cursor-default"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ background: "#6366f1", opacity: hovered === i ? 1 : 0.6 }}
            />
            <span className="text-text-muted truncate" title={d.desc}>
              {d.label}
            </span>
            <span className="ml-auto font-mono text-text-secondary shrink-0">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
