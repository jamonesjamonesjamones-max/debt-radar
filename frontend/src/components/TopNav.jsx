/**
 * TopNav — Barra superior con input de ruta, slider workers, recent paths, y botón de escaneo.
 */

import { useState, useEffect, useRef } from "react";
import { shortenPath } from "../utils/paths";

const STORAGE_KEY = "debtradar-recent-paths";
const MAX_RECENT = 5;

export default function TopNav({
  path,
  setPath,
  workers,
  setWorkers,
  onScan,
  onReset,
  scanning,
}) {
  const [recentPaths, setRecentPaths] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  // Cargar paths recientes de localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setRecentPaths(JSON.parse(stored));
      }
    } catch {
      // localStorage no disponible
    }
  }, []);

  // Filtrar paths basado en input actual
  const filteredPaths = path.trim()
    ? recentPaths.filter((p) =>
        p.toLowerCase().includes(path.toLowerCase())
      )
    : recentPaths;

  const savePath = (newPath) => {
    if (!newPath || !newPath.trim()) return;
    const trimmed = newPath.trim();
    const updated = [trimmed, ...recentPaths.filter((p) => p !== trimmed)].slice(
      0,
      MAX_RECENT
    );
    setRecentPaths(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // localStorage no disponible
    }
  };

  const handleScan = () => {
    if (!path.trim()) return;
    savePath(path.trim());
    setShowSuggestions(false);
    onScan();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleScan();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan();
    }
    if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const selectPath = (selectedPath) => {
    setPath(selectedPath);
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <header className="border-b border-surface-3 bg-surface-1 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4 flex-wrap lg:flex-nowrap">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xl" aria-hidden="true">📡</span>
          <span className="text-xl font-bold text-text-primary tracking-tight">
            Debt<span className="text-accent">Radar</span>
          </span>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-3 min-w-0 flex-wrap lg:flex-nowrap">
          {/* Input de ruta con dropdown */}
          <div className="flex-1 relative min-w-[220px]">
            <label htmlFor="repo-path-input" className="sr-only">
              Repository path
            </label>
            <input
              id="repo-path-input"
              ref={inputRef}
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onKeyDown={handleKeyDown}
              placeholder="Paste your project path, e.g. C:\Users\you\my-project"
              disabled={scanning}
              aria-label="Repository path to scan"
              className="w-full bg-surface-2 border border-surface-3 rounded-md px-4 py-2.5
                         text-sm text-text-primary placeholder:text-text-muted
                         focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30
                         disabled:opacity-50 transition-colors font-mono"
            />

            {/* Dropdown de paths recientes */}
            {showSuggestions && filteredPaths.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface-2 border border-surface-4 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                <div className="px-3 py-2 text-[10px] text-text-muted uppercase tracking-wider border-b border-surface-3">
                  Recent paths
                </div>
                {filteredPaths.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectPath(p);
                    }}
                    title={p}
                    className="w-full break-all px-3 py-2 text-left text-sm font-mono text-text-secondary
                               hover:bg-surface-3 transition-colors"
                  >
                    {shortenPath(p, 4)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Slider de workers */}
          <div
            className="flex items-center gap-2 shrink-0"
            title="Number of files analyzed in parallel. More workers = faster scan, more CPU usage."
          >
            <span className="text-sm" aria-hidden="true">🐢</span>
            <div className="flex flex-col items-center gap-1">
              <label htmlFor="workers-slider" className="text-[10px] text-text-muted uppercase tracking-wider whitespace-nowrap">
                Workers: <span className="text-accent font-mono font-semibold">{workers}</span>
              </label>
              <input
                id="workers-slider"
                type="range"
                min={1}
                max={8}
                value={workers}
                onChange={(e) => setWorkers(Number(e.target.value))}
                disabled={scanning}
                aria-label={`Parallel workers: ${workers}`}
                className="w-24 accent-accent h-1 cursor-pointer disabled:opacity-50"
              />
            </div>
            <span className="text-sm" aria-hidden="true">🚀</span>
          </div>

          {/* Botón */}
          {scanning ? (
            <button
              type="button"
              onClick={onReset}
              className="shrink-0 px-5 py-2.5 rounded-md text-sm font-medium
                         bg-surface-3 text-text-secondary hover:bg-surface-4
                         transition-colors"
            >
              Cancel
            </button>
          ) : (
            <button
              type="submit"
              disabled={!path.trim()}
              title={!path.trim() ? "Enter a project path first" : "Start scanning this repository"}
              className="shrink-0 px-5 py-2.5 rounded-md text-sm font-medium
                         bg-accent text-white hover:bg-accent-hover
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              Start Scan
            </button>
          )}
        </form>
      </div>
    </header>
  );
}
