/**
 * LoadingState — Estado de carga con checklist de fases animado.
 */
import { StopwatchIcon, CheckIcon } from "./ui/Icons";

export default function LoadingState({ progress }) {
  const { percent, elapsed, currentFile, filesCompleted, totalFiles } = progress || {};
  const pct = Math.min(percent || 0, 100);
  const elapsedStr = formatTime(elapsed || 0);

  // Determine current phase
  const phases = [
    { key: "discover", label: "Discovering files", done: pct > 0 || filesCompleted > 0 },
    { key: "analyze", label: "Analyzing structure", done: pct > 5 || filesCompleted > 5 },
    { key: "score", label: "Computing scores", done: pct >= 80 },
    { key: "report", label: "Generating report", done: pct >= 100 },
  ];
  const currentPhase = phases.find(p => !p.done) || phases[phases.length - 1];

  let phase = "Analyzing files";
  let phaseDesc = "Scanning for code issues";
  if (pct === 0 && filesCompleted === 0) { phase = "Discovering files"; phaseDesc = "Walking through the directory tree"; }
  else if (pct >= 100) { phase = "Aggregating results"; phaseDesc = "Computing scores and generating report"; }

  return (
    <div className="max-w-lg mx-auto px-6 py-24 flex flex-col items-center gap-8 animate-fade-in" role="status" aria-live="polite" aria-label={`Scan in progress: ${Math.round(pct)}% - ${phase}`}>
      <div className="relative w-24 h-24">
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="42" fill="none" stroke="#222228" strokeWidth="4" />
          <circle cx="48" cy="48" r="42" fill="none" stroke="#6366f1" strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 42}`}
            strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
            className="transition-all duration-500 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-mono font-bold text-accent">{Math.round(pct)}%</span>
        </div>
      </div>

      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 rounded-pill">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-sm font-medium text-accent">{phase}</span>
        </div>
        <p className="text-text-muted text-xs">{phaseDesc}</p>
        <p className="text-text-primary font-medium">
          <span className="font-mono text-accent">{filesCompleted || 0}</span>
          {totalFiles > 0 && <span className="text-text-muted"> / {totalFiles}</span>} files processed
        </p>
        {currentFile && (
          <div className="max-w-md mx-auto">
            <p className="text-text-muted text-xs font-mono truncate bg-surface-2/50 rounded-md px-3 py-1.5 border border-surface-3/50">{currentFile}</p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full">
        <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-accent-muted to-accent rounded-full transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Progress steps checklist */}
      <div className="w-full max-w-sm space-y-2">
        {phases.map((p) => (
          <div key={p.key} className="flex items-center gap-2.5 text-xs">
            <div className={
              "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 " +
              (p.done
                ? "bg-semantic-success-bg text-semantic-success"
                : p.key === currentPhase.key
                ? "bg-accent/15 text-accent animate-pulse-soft"
                : "bg-surface-3 text-text-muted")
            }>
              {p.done ? (
                <CheckIcon size={10} />
              ) : (
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
              )}
            </div>
            <span className={
              p.done
                ? "text-semantic-success font-medium"
                : p.key === currentPhase.key
                ? "text-text-primary font-medium"
                : "text-text-muted"
            }>{p.label}</span>
            {p.done && <span className="text-[9px] text-semantic-success ml-auto">Done</span>}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 text-text-muted text-xs font-mono">
        <StopwatchIcon size={16} className="opacity-60" />
        <span>{elapsedStr}</span>
      </div>
    </div>
  );
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}