/**
 * LoadingState — Estado de carga con cronómetro visible, progreso y archivo actual.
 */

export default function LoadingState({ progress }) {
  const { percent, elapsed, currentFile, filesCompleted, totalFiles } =
    progress;

  return (
    <div className="max-w-2xl mx-auto px-6 py-24 flex flex-col items-center gap-8">
      {/* Spinner */}
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-2 border-surface-3" />
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-mono font-bold text-accent">
            {Math.round(percent)}%
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="text-center space-y-2">
        <p className="text-text-primary font-medium">
          Analyzing{" "}
          <span className="font-mono text-accent">{filesCompleted}</span>
          {totalFiles > 0 && (
            <span className="text-text-muted">/{totalFiles}</span>
          )}{" "}
          files…
        </p>
        <p className="text-text-secondary text-sm">
          Elapsed time:{" "}
          <span className="font-mono">{elapsed.toFixed(1)}s</span>
        </p>
        {currentFile && (
          <p className="text-text-muted text-xs font-mono truncate max-w-md">
            {currentFile}
          </p>
        )}
      </div>

      {/* Barra de progreso */}
      <div className="w-full max-w-md">
        <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
