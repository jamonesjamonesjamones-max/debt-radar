/**
 * DependencyGraph -- Interactive force-directed graph of file dependencies.
 * Uses custom force layout (no d3 dependency). Renders in SVG.
 *
 * Performance: physics simulation mutates the SVG DOM directly via refs,
 * eliminating React re-renders during the 200-iteration animation loop.
 * Only hover state triggers React reconciliation (infrequent, acceptable).
 */

import { useState, useEffect, useRef, memo } from 'react';
import { motion } from 'framer-motion';
import { API_BASE } from '../api/client';
import { shortenPath } from '../utils/paths';
import { SAMPLE_JOB_ID, SAMPLE_DEPENDENCY_GRAPH } from '../utils/sampleData';

const API_URL = (API_BASE || "").replace(/[/]+$/, "");

const REPULSION = 800;
const ATTRACTION = 0.005;
const DAMPING = 0.85;
const CENTER_GRAVITY = 0.01;

function ForceGraph({ nodes, edges, width, height, onSelectNode }) {
  const svgRef = useRef(null);
  const positionsRef = useRef({});
  const velocitiesRef = useRef({});
  const animRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [hoveredNode, setHoveredNode] = useState(null);

  // Initialize positions in a circle (one-time setup)
  useEffect(() => {
    const cx = width / 2, cy = height / 2;
    const radius = Math.min(width, height) * 0.35;
    const pos = {};
    const vel = {};
    nodes.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
      pos[n.id] = { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
      vel[n.id] = { x: 0, y: 0 };
    });
    positionsRef.current = pos;
    velocitiesRef.current = vel;
    setReady(true);
  }, [nodes, width, height]);

  // Physics simulation — mutates SVG DOM directly, no React re-renders
  useEffect(() => {
    if (!ready || nodes.length === 0) return;
    let running = true;
    let iteration = 0;
    const maxIter = 200;

    function step() {
      if (!running || iteration >= maxIter) return;
      iteration++;

      const prev = positionsRef.current;
      const vel = velocitiesRef.current;
      const cx = width / 2, cy = height / 2;
      const newPos = {}, newVel = {};
      const svg = svgRef.current;

      for (const node of nodes) {
        const p = prev[node.id];
        if (!p) continue;
        let fx = 0, fy = 0;
        fx += (cx - p.x) * CENTER_GRAVITY;
        fy += (cy - p.y) * CENTER_GRAVITY;

        for (const other of nodes) {
          if (other.id === node.id) continue;
          const op = prev[other.id];
          if (!op) continue;
          const dx = p.x - op.x, dy = p.y - op.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = REPULSION / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        }

        for (const edge of edges) {
          let tid = null;
          if (edge.source === node.id) tid = edge.target;
          else if (edge.target === node.id) tid = edge.source;
          if (tid === null) continue;
          const tp = prev[tid];
          if (!tp) continue;
          fx += (tp.x - p.x) * ATTRACTION;
          fy += (tp.y - p.y) * ATTRACTION;
        }

        let vx = (vel[node.id]?.x || 0) + fx;
        let vy = (vel[node.id]?.y || 0) + fy;
        vx *= DAMPING; vy *= DAMPING;
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > 5) { vx = (vx / speed) * 5; vy = (vy / speed) * 5; }
        newVel[node.id] = { x: vx, y: vy };
        newPos[node.id] = { x: p.x + vx, y: p.y + vy };
      }

      positionsRef.current = newPos;
      velocitiesRef.current = newVel;

      // Direct DOM mutation — update transforms without React reconciliation
      if (svg) {
        for (const node of nodes) {
          const g = svg.querySelector(`[data-node-id="${node.id}"]`);
          if (g && newPos[node.id]) {
            g.setAttribute('transform', `translate(${newPos[node.id].x},${newPos[node.id].y})`);
          }
        }
        for (let i = 0; i < edges.length; i++) {
          const line = svg.querySelector(`[data-edge-idx="${i}"]`);
          if (line) {
            const sp = newPos[edges[i].source], tp = newPos[edges[i].target];
            if (sp && tp) {
              line.setAttribute('x1', sp.x);
              line.setAttribute('y1', sp.y);
              line.setAttribute('x2', tp.x);
              line.setAttribute('y2', tp.y);
            }
          }
        }
      }

      animRef.current = requestAnimationFrame(step);
    }

    animRef.current = requestAnimationFrame(step);
    return () => { running = false; if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [ready, nodes, edges, width, height]);

  // Render SVG with initial positions from ref
  if (!ready) return null;

  const initPos = positionsRef.current;

  const getNodeColor = (score) => {
    if (score >= 80) return { fill: "#22c55e", stroke: "#16a34a" };
    if (score >= 60) return { fill: "#84cc16", stroke: "#65a30d" };
    if (score >= 40) return { fill: "#f59e0b", stroke: "#d97706" };
    if (score >= 20) return { fill: "#f97316", stroke: "#ea580c" };
    return { fill: "#ef4444", stroke: "#dc2626" };
  };

  const SIZE = 10;

  return (
    <svg ref={svgRef} width={width} height={height} className="bg-transparent" role="img" aria-label="File dependency graph">
      <defs>
        <filter id="node-glow">
          <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodOpacity="0.3" />
        </filter>
      </defs>
      {edges.map((edge, i) => {
        const sp = initPos[edge.source], tp = initPos[edge.target];
        if (!sp || !tp) return null;
        return (
          <line key={"e" + i} data-edge-idx={i}
            x1={sp.x} y1={sp.y} x2={tp.x} y2={tp.y}
            stroke="rgba(148,163,184,0.2)" strokeWidth={1} strokeLinecap="round" />
        );
      })}
      {nodes.map(node => {
        const p = initPos[node.id];
        if (!p) return null;
        const c = getNodeColor(node.score);
        const hov = hoveredNode === node.id;
        const r = hov ? SIZE + 4 : SIZE;
        return (
          <g key={"n" + node.id} data-node-id={node.id}
            transform={`translate(${p.x},${p.y})`}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
            onClick={() => onSelectNode && onSelectNode(node.fullPath)}
            role="button" aria-label={node.name + " score " + node.score}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelectNode && onSelectNode(node.fullPath); }}
          >
            <circle r={r}
              fill={hov ? c.fill : c.fill + "bb"}
              stroke={hov ? "#fff" : c.stroke}
              strokeWidth={hov ? 2.5 : 1.5}
              filter={hov ? "url(#node-glow)" : undefined} />
            {hov && (
              <text y={r + 12} textAnchor="middle" fill="#e2e8f0" fontSize={9} className="font-mono">
                {shortenPath(node.name, 2)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}


function DependencyGraphInner({ jobId, onSelectFile }) {
  const [graphData, setGraphData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 400 });

  useEffect(() => {
    if (!jobId) return;
    // Demo mode: use embedded sample data instead of fetching from backend
    if (jobId === SAMPLE_JOB_ID) {
      setGraphData(SAMPLE_DEPENDENCY_GRAPH);
      setLoading(false);
      return;
    }
    setLoading(true); setError(null);
    const url = (API_URL || "") + "/api/scan/" + jobId + "/dependency-graph";
    fetch(url)
      .then(async r => {
        if (r.ok) return r.json();
        const payload = await r.json().catch(() => ({}));
        const detail = payload.detail || `HTTP ${r.status}`;
        if (r.status === 404 && /job not found|job no encontrado/i.test(detail)) {
          throw new Error("This scan session has expired. Run a new repository scan to load the dependency graph.");
        }
        throw new Error(detail);
      })
      .then(data => {
        if (!data.nodes || data.nodes.length === 0) throw new Error("No dependency data available");
        setGraphData(data); setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [jobId]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setDimensions({ width: entry.contentRect.width, height: Math.max(400, entry.contentRect.height) });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  if (loading) return <div className="card-premium p-6"><div className="h-80 animate-pulse rounded-xl bg-surface-2/50" /></div>;
  if (error) return (
    <div className="card-premium p-6">
      <div className="flex items-center gap-3 text-sm text-text-muted">
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Dependency graph: {error}</span>
      </div>
    </div>
  );
  if (!graphData || graphData.nodes.length === 0) return null;

  return (
    <div className="card-premium overflow-hidden" ref={containerRef}>
      <div className="px-6 py-3 border-b border-surface-3/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
          </svg>
          <h3 className="text-sm font-semibold text-text-primary">Dependency Graph</h3>
          <span className="text-[10px] text-text-muted font-mono">{graphData.nodes.length} files, {graphData.edges.length} connections</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-text-muted">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#22c55e" }} /> Good
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#f59e0b" }} /> Medium
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ef4444" }} /> Poor
        </div>
      </div>
      <div className="p-4" style={{ minHeight: 400, position: "relative" }}>
        <ForceGraph nodes={graphData.nodes} edges={graphData.edges}
          width={dimensions.width - 32} height={dimensions.height - 32}
          onSelectNode={onSelectFile} />
      </div>
    </div>
  );
}

const DependencyGraph = memo(function DependencyGraph(props) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.15 }}>
      <DependencyGraphInner {...props} />
    </motion.div>
  );
});

export default DependencyGraph;
