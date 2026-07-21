/**
 * Dashboard — Contenedor principal que orquesta todos los componentes de visualización.
 */

import { useState, lazy, Suspense, memo, useMemo } from "react";
import { motion } from "framer-motion";
import SummaryBar from "./SummaryBar";
import GitTabs from "./GitTabs";
import InfoTooltip from "./ui/InfoTooltip";
import { shortenPath } from "../utils/paths";

const HeatMap = lazy(() => import("./HeatMap"));
const RadarChart = lazy(() => import("./RadarChart"));
const HallOfShame = lazy(() => import("./HallOfShame"));
const CodeViewer = lazy(() => import("./CodeViewer"));
const ScanHistory = lazy(() => import("./ScanHistory"));
const ScanDiff = lazy(() => import("./ScanDiff"));
const DependencyGraph = lazy(() => import("./DependencyGraph"));

function LazySection({ children }) {
  return (
    <Suspense fallback={<div className="card-premium h-48 animate-pulse" />}>
      {children}
    </Suspense>
  );
}


const ExecutiveSummary = memo(function ExecutiveSummary({ summary, files }) {
  const grade = summary.grade || 'N/A';

  // Find worst file
  const sorted = useMemo(() => [...(files || [])].sort((a, b) => a.score - b.score), [files]);
  const worstFile = sorted[0];

  // Find most common violation type
  const topViolationLabel = useMemo(() => {
    const violationCounts = {};
    for (const f of files || []) {
      for (const v of f.violations || []) {
        violationCounts[v.type] = (violationCounts[v.type] || 0) + 1;
      }
    }
    const top = Object.entries(violationCounts).sort(([, a], [, b]) => b - a)[0];
    if (!top) return null;
    return {
      max_nesting: 'Excessive nesting',
      magic_number: 'Magic numbers',
      todo: 'TODOs/FIXMEs'
    }[top[0]] || top[0];
  }, [files]);

  const totalViolations = useMemo(() => summary.total_violations || 0, [summary.total_violations]);
  const avgScore = useMemo(() => summary.average_score || 0, [summary.average_score]);
  const totalFiles = useMemo(() => summary.total_files || 0, [summary.total_files]);
  const gradeColor = useMemo(() => ({ A: '#22c55e', B: '#84cc16', C: '#f59e0b', D: '#f97316', F: '#ef4444' }[grade] || '#e4e4e7'), [grade]);

  return (
    <div className='card-premium overflow-hidden animate-card-enter'>
      <div className='px-6 py-4'>
        <div className='flex items-start gap-4 flex-wrap'>
          <div className='flex items-center gap-3 shrink-0'>
            <div className='w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold font-mono' style={{ backgroundColor: gradeColor + '18', color: gradeColor, transition: 'background-color 0.3s ease, color 0.3s ease' }}>
              {grade}
            </div>
            <div>
              <p className='text-sm font-semibold text-text-primary'>Executive Summary</p>
              <p className='text-xs text-text-muted'>Key findings at a glance</p>
            </div>
          </div>
          <div className='flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-3'>
            <div className='text-center sm:text-left'>
              <p className='text-lg font-mono font-bold text-text-primary'>{totalFiles.toLocaleString()}</p>
              <p className='text-[10px] text-text-muted'>Files analyzed</p>
            </div>
            <div className='text-center sm:text-left'>
              <p className='text-lg font-mono font-bold text-text-primary'>{totalViolations.toLocaleString()}</p>
              <p className='text-[10px] text-text-muted'>Issues detected</p>
            </div>
            <div className='text-center sm:text-left'>
              <p className='text-lg font-mono font-bold' style={{ color: gradeColor }}>{avgScore}/100</p>
              <p className='text-[10px] text-text-muted'>Average score</p>
            </div>
            <div className='text-center sm:text-left'>
              <p className='text-lg font-mono font-bold text-text-primary'>{topViolationLabel || 'N/A'}</p>
              <p className='text-[10px] text-text-muted'>Most common issue</p>
            </div>
          </div>
        </div>
        {worstFile && (
          <div className='mt-3 pt-3 border-t border-surface-3 flex items-center gap-2 text-xs text-text-muted'>
            <span className='inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-3/50 font-mono'>
              <span className='text-semantic-error font-bold'>{worstFile.score}</span>
              <span className='opacity-60'>{worstFile.path.split('/').pop() || worstFile.path}</span>
            </span>
            <span>worst file — <span className='font-medium text-text-secondary'>{worstFile.violations?.length || 0}</span> issues found</span>
          </div>
        )}
      </div>
    </div>
  );
});
export default function Dashboard({ data, jobId, analysisSource = "server" }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [focusMode, setFocusMode] = useState(() => {
    try { return localStorage.getItem("debtradar-focus-mode") === "true"; }
    catch { return false; }
  });

  const toggleFocusMode = () => {
    const next = !focusMode;
    setFocusMode(next);
    try { localStorage.setItem("debtradar-focus-mode", next ? "true" : "false"); } catch {}
  };

  const { summary, files = [], skipped_files = [] } = data;
  const hasRepositoryInsights = analysisSource === "server" || analysisSource === "demo";
  const serverJobId = analysisSource === "server" ? jobId : null;

  const handleSelectFile = (filePath) => {
    const found = files.find(f => f.path === filePath);
    if (found) setSelectedFile(found);
    else console.warn("Selected file was not found in scan results:", filePath);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Focus mode toggle */}
      <div className="flex items-center justify-end">
        <button
          onClick={toggleFocusMode}
          className={`btn-sm ${focusMode ? "btn-primary" : "btn-ghost"} btn-magnetic`}
          aria-label={focusMode ? "Show full dashboard" : "Focus on action items"}
          title={focusMode ? "Show all charts" : "Hide charts, show only action items"}
        >
          {focusMode ? "Full View" : "Action Mode"}
        </button>
      </div>

      {/* Resumen superior */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}><SummaryBar summary={summary} jobId={serverJobId} comparison={data.comparison} /></motion.div>

      {/* Executive Summary — Natural language insight */}
      {summary && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}><ExecutiveSummary summary={summary} files={files} /></motion.div>
      )}

      {/* Scan comparison — only show when comparison data exists */}
      {!focusMode && analysisSource === "server" && data.comparison && (
        <div style={{animationDelay:"0.12s"}} className="animate-card-enter"><LazySection><ScanDiff jobId={jobId} /></LazySection></div>
      )}

      {/* Scan history + comparison — hidden in focus mode */}
      {!focusMode && data.comparison && (
        <LazySection><ScanHistory path={data.summary?.scan_path} comparison={data.comparison} /></LazySection>
      )}

      {/* Grid principal: Treemap + Radar — hidden in focus mode */}
      {!focusMode && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div style={{animationDelay:"0.18s"}} className="animate-card-enter"><LazySection><HeatMap files={files} onSelect={setSelectedFile} /></LazySection></div>
        </div>
        <div>
          <div style={{animationDelay:"0.24s"}} className="animate-card-enter"><LazySection><RadarChart files={files} /></LazySection></div>
        </div>
      </div>
      )}

      {/* Dependency Graph — hidden in focus mode */}
      {!focusMode && hasRepositoryInsights && jobId && (
        <div style={{animationDelay:"0.30s"}} className="animate-card-enter"><LazySection><DependencyGraph jobId={jobId} onSelectFile={handleSelectFile} /></LazySection></div>
      )}

      {/* Hall of Shame */}
      <div style={{animationDelay:"0.36s"}} className="animate-card-enter"><LazySection><HallOfShame files={files} onSelect={setSelectedFile} /></LazySection></div>

      {/* Git Integrations: Historial + Blame — hidden in focus mode */}
      {!focusMode && hasRepositoryInsights && jobId && <GitTabs jobId={jobId} />}

      {/* Archivos skipped */}
      {skipped_files.length > 0 && (
        <div className="card px-5 py-4">
          <h3 className="text-sm font-medium text-text-secondary mb-2">
            Skipped files ({skipped_files.length})
          </h3>
          <div className="space-y-1">
            {skipped_files.map((sf, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="block break-all font-mono text-text-secondary" title={sf.path}>
                    {shortenPath(sf.path, 4)}
                  </span>
                  {shortenPath(sf.path, 4) !== sf.path && (
                    <span className="mt-0.5 block break-all font-mono text-[10px] leading-relaxed text-text-muted">
                      {sf.path}
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-text-muted">{sf.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Code Viewer Modal */}
      {selectedFile && (
        <LazySection><CodeViewer file={selectedFile} onClose={() => setSelectedFile(null)} /></LazySection>
      )}
    </div>
  );
}
