/**
 * TopNav — Barra superior rediseñada con logo profesional, input de ruta,
 * slider de workers, dropdown de paths recientes, y botón de escaneo.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { shortenPath } from "../utils/paths";
import { DebtRadarLogoSVG, PlayIcon, CloseIcon, TurtleIcon, RocketIcon, QuestionIcon } from "./ui/Icons";

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
  autoFocus,
  onShowTutorial,
  onShowPortfolio,
}) {
  const [recentPaths, setRecentPaths] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isDockerMode, setIsDockerMode] = useState(false);
  const inputRef = useRef(null);
  const blurTimeoutRef = useRef(null);

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

  // Cleanup timeout al desmontar
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  // Actualizar modo según path
  useEffect(() => {
    setIsDockerMode(path.startsWith("/workspace") || path.startsWith("/app"));
  }, [path]);

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 sm:gap-4 flex-wrap sm:flex-nowrap">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
            <DebtRadarLogoSVG size={22} />
          </div>
          <div className="hidden sm:block">
            <span className="text-base font-bold text-text-primary tracking-tight">
              Debt<span className="text-accent">Radar</span>
            </span>
            <span className="text-[10px] text-text-muted block leading-none mt-0.5">
              Code Health Auditor
            </span>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap sm:flex-nowrap">
          {/* Input de ruta con dropdown */}
          <div className="flex-1 relative min-w-[180px] sm:min-w-[220px]">
            <div className="relative">
              {/* Modo badge */}
              {isDockerMode && (
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <span className="text-[9px] font-medium bg-accent/15 text-accent px-1.5 py-0.5 rounded-pill uppercase tracking-wider">
                    Docker
                  </span>
                </div>
              )}
              <label htmlFor="repo-path-input" className="sr-only">
                Repository path
              </label>
              <input
                id="repo-path-input"
                ref={inputRef}
                type="text"
                value={path}
                autoFocus={autoFocus}
                onChange={(e) => setPath(e.target.value)}
                onFocus={() => {
                  if (blurTimeoutRef.current !== null) {
                    clearTimeout(blurTimeoutRef.current);
                    blurTimeoutRef.current = null;
                  }
                  setShowSuggestions(true);
                }}
                onBlur={() => {
                  blurTimeoutRef.current = setTimeout(() => {
                    setShowSuggestions(false);
                    blurTimeoutRef.current = null;
                  }, 200);
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  isDockerMode
                    ? "/workspace"
                    : "C:\\Users\\you\\my-project or /home/user/project"
                }
                disabled={scanning}
                role="combobox"
                aria-expanded={showSuggestions && filteredPaths.length > 0}
                aria-controls="recent-paths-listbox"
                aria-autocomplete="list"
                aria-label="Repository path to scan"
                aria-describedby={!path.trim() && !scanning ? "path-hint-text" : undefined}
                aria-invalid={path.trim() && !scanning && !isDockerMode ? "false" : undefined}
                className={`input text-xs sm:text-sm ${isDockerMode ? "pl-16" : ""}`}
              />
              {/* Hidden hint for screen readers when no path is entered */}
              {!path.trim() && !scanning && (
                <span id="path-hint-text" className="sr-only">
                  {isDockerMode
                    ? "Enter /workspace as the path when running in Docker"
                    : "Enter the absolute path to the project directory you want to scan"}
                </span>
              )}
            </div>

            {/* Dropdown de paths recientes */}
            <AnimatePresence>
            {showSuggestions && filteredPaths.length > 0 && (
              <motion.div
                id="recent-paths-listbox"
                key="recent-paths-dropdown"
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                role="listbox"
                aria-label="Recent paths"
                className="absolute top-full left-0 right-0 mt-1 bg-surface-2 border border-surface-4 rounded-card shadow-dropdown z-10 max-h-60 overflow-y-auto animate-scale-in"
              >
                <div className="px-3 py-2 text-eyebrow text-text-muted border-b border-surface-3 flex items-center justify-between">
                  <span id="recent-paths-label">Recent paths</span>
                  <span className="text-[9px] text-text-muted">{filteredPaths.length}</span>
                </div>
                {filteredPaths.map((p, i) => (
                  <button
                    key={i}
                    id={`recent-path-${i}`}
                    type="button"
                    role="option"
                    aria-selected={path === p}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectPath(p);
                    }}
                    title={p}
                    className="w-full px-3 py-2.5 text-left interactive-transition hover:bg-surface-3 focus:bg-surface-3 focus:outline-none animate-fade-in"
                  >
                    <span className="block text-xs font-mono text-text-primary">
                      {shortenPath(p, 4)}
                    </span>
                    {shortenPath(p, 4) !== p && (
                      <span className="block text-[10px] font-mono text-text-muted truncate mt-0.5">
                        {p}
                      </span>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
            </AnimatePresence>

            {/* Suggest Docker mode hint */}
            {!path.trim() && !isDockerMode && filteredPaths.length === 0 && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:block pointer-events-none">
                <span className="text-[10px] text-text-muted">/workspace</span>
              </div>
            )}
          </div>

          {/* Slider de workers */}
          <div
            className="flex items-center gap-1.5 sm:gap-2 shrink-0"
            title="Number of files analyzed in parallel. More workers = faster scan, more CPU usage."
          >
            <span className="hidden sm:inline text-text-muted" aria-hidden="true"><TurtleIcon size={14} /></span>
            <div className="flex flex-col items-center gap-0.5">
              <label htmlFor="workers-slider" className="text-[9px] sm:text-[10px] text-text-muted uppercase tracking-wider whitespace-nowrap">
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
                className="w-16 sm:w-24 accent-accent h-1 cursor-pointer disabled:opacity-50"
              />
            </div>
            <span className="hidden sm:inline text-text-muted" aria-hidden="true"><RocketIcon size={14} /></span>
          </div>

          {/* Botón */}
          {scanning ? (
            <button
              type="button"
              onClick={() => { if (window.confirm("Cancel the current scan? Progress will be lost.")) onReset(); }}
              className="btn-secondary btn-sm btn-magnetic"
              aria-label="Cancel scan (Esc)"
            >
              <CloseIcon size={14} />
              <span className="hidden sm:inline">Cancel</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!path.trim()}
              title={!path.trim() ? "Type a project path above to enable scanning" : "Start scanning (Ctrl+Enter)"}
              className={`btn-primary btn-sm btn-magnetic relative overflow-hidden ${path.trim() && !scanning ? "animate-scan-pulse" : ""}`}
            >
              {path.trim() && <span className="absolute inset-0 bg-white/5 animate-shimmer rounded-md pointer-events-none" />}
              <PlayIcon size={14} />
              <span>Scan</span>
            </button>
          )}
        </form>

        {/* Tutorial button */}
        {!scanning && (
          <button
            type="button"
            onClick={onShowPortfolio}
            className="btn-ghost btn-sm !px-1.5"
            title="View all projects"
            aria-label="Portfolio dashboard"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="10" width="3" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="6.5" y="7" width="3" height="7" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="11" y="4" width="3" height="10" rx="0.5" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
        )}
        {!scanning && (
          <button
            type="button"
            onClick={onShowTutorial}
            className="btn-ghost btn-sm !px-1.5"
            title="Show tutorial again"
            aria-label="Show onboarding tutorial"
          >
            <QuestionIcon size={14} />
          </button>
        )}
      </div>
    </header>
  );
}
