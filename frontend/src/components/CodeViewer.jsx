/**
 * CodeViewer — Modal rediseñado con tabs (Issues / Deductions / Refactor),
 * breadcrumb de ruta, mejor contraste y foco controlado.
 * Usa iconos SVG en lugar de emojis.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../api/client";
import { SeverityBadge } from "./ui/Badge";
import { ConfettiIcon, LoadingIcon, RobotIcon, CopyIcon, CheckIcon, CloseIcon } from "./ui/Icons";

const TYPE_LABELS = {
  max_nesting: "Excessive Nesting",
  magic_number: "Magic Number",
  todo: "TODO/FIXME",
};

export default function CodeViewer({ file, onClose }) {
  const [activeTab, setActiveTab] = useState("issues");
  const [ollamaAvailable, setOllamaAvailable] = useState(null);
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/ollama-status`)
      .then((r) => r.json())
      .then((d) => setOllamaAvailable(d.available))
      .catch(() => setOllamaAvailable(false));
  }, []);

  // Focus trap: guardar elemento previo y enfocar el modal
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    // Pequeño delay para que el modal esté en el DOM
    requestAnimationFrame(() => {
      modalRef.current?.focus();
    });

    return () => {
      // Restaurar foco al cerrar
      previousFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Focus trap: Tab y Shift+Tab dentro del modal
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!file) return null;

  const violationsByType = {};
  for (const v of file.violations || []) {
    if (!violationsByType[v.type]) violationsByType[v.type] = [];
    violationsByType[v.type].push(v);
  }

  return (
    <AnimatePresence>
      <motion.div
        key="modal-wrapper"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
      >
        {/* Overlay */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        />

        {/* Modal */}
        <motion.div
          role="dialog"
          key="modal-content"
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        aria-modal="true"
        aria-label={`File details: ${file.path}`}
        ref={modalRef}
        tabIndex={-1}
        className="modal-content max-w-4xl mx-2 sm:mx-0 max-h-[90vh] sm:max-h-[85vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header flex-wrap gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-text-muted font-mono truncate" title={file.path}>
              {file.path}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-caption text-text-secondary">
                {file.lines} lines
              </span>
              <span className="w-1 h-1 rounded-full bg-surface-4" />
              <span className="text-caption text-text-secondary">
                Language: {file.language || "unknown"}
              </span>
              <span className="w-1 h-1 rounded-full bg-surface-4" />
              <span className="text-caption text-text-secondary">
                Score: <span className="font-bold text-text-primary">{file.score}</span>
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close file details"
            className="btn-ghost btn-sm shrink-0 !px-2"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-surface-3" role="tablist" aria-label="File detail sections" aria-orientation="horizontal">
          {[
            { key: "issues", label: "Issues", count: file.violations?.length || 0 },
            { key: "deductions", label: "Deductions" },
            { key: "refactor", label: "Refactor" },
          ].map((tab) => {
            const isSelected = activeTab === tab.key;
            return (
            <button
              key={tab.key}
              id={`codeviewer-tab-${tab.key}`}
              role="tab"
              aria-selected={isSelected}
              aria-controls={`codeviewer-panel-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-xs font-medium interactive-transition rounded-t-md border-b-2 -mb-[1px] ${
                isSelected
                  ? "border-accent text-accent bg-accent/5"
                  : "border-transparent text-text-muted hover:text-text-secondary hover:bg-surface-3/30"
              }`}
            >
              {tab.label}
              {tab.count != null && tab.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-pill bg-accent/15 text-accent text-[9px]">
                  {tab.count}
                </span>
              )}
            </button>
            );
          })}
        </div>

        {/* Content by tab */}
        <div className="modal-body p-6 space-y-3" role="tabpanel" id={`codeviewer-panel-${activeTab}`} aria-labelledby={`codeviewer-tab-${activeTab}`}>
          {/* TAB: Issues */}
          {activeTab === "issues" && (
            <>
              {file.violations?.length > 0 ? (
                <div className="space-y-3">
                  {file.violations
                    .sort((a, b) => a.line - b.line)
                    .map((v, i) => (
                      <div
                        key={i}
                        className={`rounded-md px-4 py-3 border-l-2 ${
                          v.severity === "high"
                            ? "bg-semantic-error-bg border-semantic-error"
                            : v.severity === "medium"
                            ? "bg-semantic-warning-bg border-semantic-warning"
                            : "bg-surface-3/30 border-text-muted"
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                          <span className="text-xs font-mono text-text-muted">
                            Line {v.line}
                            {v.column != null && `:${v.column}`}
                          </span>
                          <SeverityBadge severity={v.severity} />
                          <span className="text-caption text-text-secondary">
                            {TYPE_LABELS[v.type] || v.type}
                          </span>
                        </div>
                        {v.context && (
                          <pre className="text-xs font-mono text-text-primary bg-surface-0/60 rounded px-3 py-2 mt-2 overflow-x-auto border border-surface-3/50">
                            {v.context}
                          </pre>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-12 text-text-muted text-sm">
                  <div className="flex justify-center mb-3"><ConfettiIcon size={32} className="text-semantic-success" /></div>
                  No issues found in this file
                </div>
              )}
            </>
          )}

          {/* TAB: Deductions */}
          {activeTab === "deductions" && (
            <>
              {file.deductions ? (
                <div className="space-y-3">
                  {Object.entries(file.deductions)
                    .filter(([, v]) => v !== 0)
                    .map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between px-4 py-3 bg-surface-0/50 rounded-md border border-surface-3/50">
                        <span className="text-sm text-text-secondary capitalize">
                          {key.replace(/_/g, " ")}
                        </span>
                        <span className="font-mono font-bold text-semantic-error">
                          -{Math.abs(value)} pts
                        </span>
                      </div>
                    ))}
                  {Object.values(file.deductions).every((v) => v === 0) && (
                    <div className="text-center py-8 text-text-muted text-sm">
                      No deductions applied. File has a perfect score.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-text-muted text-sm">
                  No deduction data available.
                </div>
              )}
            </>
          )}

          {/* TAB: Refactor */}
          {activeTab === "refactor" && (
            <div className="space-y-4">
              {ollamaAvailable === null && (
                <div className="text-center py-8 text-text-muted text-sm space-y-2">
                  <div className="flex justify-center">
                    <LoadingIcon size={24} className="text-accent" />
                  </div>
                  <p>Checking Ollama availability…</p>
                </div>
              )}
              {ollamaAvailable === false && (
                <div className="text-center py-8 space-y-3">
                  <div className="flex justify-center"><RobotIcon size={32} className="text-text-muted" /></div>
                  <p className="text-text-secondary text-sm">
                    Ollama is not available. Install it for local AI refactor suggestions.
                  </p>
                  <p className="text-text-muted text-xs">
                    Visit <code className="text-accent font-mono">ollama.com</code> to get started.
                  </p>
                </div>
              )}
              {ollamaAvailable === true && (
                <div className="space-y-4">
                  <p className="text-text-secondary text-sm">
                    Select a violation type to get a refactor suggestion from local AI (Ollama):
                  </p>
                  {Object.entries(violationsByType).map(([type, violations]) => (
                    <div key={type} className="space-y-2">
                      <h4 className="text-sm font-medium text-text-primary">
                        {TYPE_LABELS[type] || type} ({violations.length})
                      </h4>
                      <div className="space-y-2">
                        {violations.slice(0, 3).map((v, i) => (
                          <RefactorBlock
                            key={i}
                            code={v.context}
                            violationType={type}
                            context={v.context}
                            line={v.line}
                          />
                        ))}
                        {violations.length > 3 && (
                          <p className="text-xs text-text-muted">
                            +{violations.length - 3} more of this type
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer con shortcuts */}
        <div className="modal-footer">
          <span className="text-[10px] text-text-muted">
            <kbd className="px-1 py-0.5 bg-surface-3 rounded text-text-muted font-mono">ESC</kbd> to close
          </span>
          <button onClick={onClose} className="btn-secondary btn-sm btn-magnetic">
            Close
          </button>
        </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function RefactorBlock({ code, violationType, context, line }) {
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRefactor = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/refactor-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code || context,
          violation_type: violationType,
          context: context,
        }),
      });
      const data = await res.json();
      setSuggestion(data.suggestion || data.error || "No suggestion available");
    } catch (err) {
      setSuggestion("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (suggestion) {
      navigator.clipboard.writeText(suggestion);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border border-surface-3 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-surface-0/50">
        <span className="text-[10px] text-text-muted font-mono">
          Line {line}
        </span>
        {!suggestion && (
          <button
            onClick={handleRefactor}
            disabled={loading}
            className="text-[10px] px-2 py-1 rounded bg-accent/20 text-accent hover:bg-accent/30 interactive-transition disabled:opacity-50 inline-flex items-center gap-1 btn-magnetic"
          >
            {loading ? <LoadingIcon size={12} /> : <RobotIcon size={12} />}
            <span>Suggest</span>
          </button>
        )}
      </div>

      {code && (
        <pre className="text-xs font-mono text-text-secondary p-3 bg-surface-0/30 overflow-x-auto border-t border-surface-3/50">
          {code}
        </pre>
      )}

      {suggestion && (
        <div className="border-t border-surface-3">
          <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2/50">
            <span className="text-[10px] text-text-muted inline-flex items-center gap-1">
              <RobotIcon size={10} /> AI Suggestion
            </span>
            <button
              onClick={handleCopy}
              className="text-[10px] px-2 py-0.5 rounded bg-surface-3 text-text-secondary hover:bg-surface-4 interactive-transition inline-flex items-center gap-1 btn-magnetic"
            >
              {copied ? <CheckIcon size={10} className="text-semantic-success" /> : <CopyIcon size={10} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <pre className="text-xs font-mono text-text-primary p-3 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
            {suggestion}
          </pre>
        </div>
      )}
    </div>
  );
}
