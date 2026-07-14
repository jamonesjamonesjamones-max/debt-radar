/**
 * CodeViewer — Modal que muestra el archivo con violaciones resaltadas y números de línea.
 */

import { useState, useEffect } from "react";
import { API_BASE } from "../api/client";

const SEVERITY_COLORS = {
  high: "bg-grade-f/20 border-l-2 border-grade-f",
  medium: "bg-grade-c/20 border-l-2 border-grade-c",
  low: "bg-grade-b/10 border-l-2 border-grade-b",
};

const TYPE_LABELS = {
  max_nesting: "Excessive Nesting",
  magic_number: "Magic Number",
  todo: "TODO/FIXME",
};

export default function CodeViewer({ file, onClose }) {
  const [ollamaAvailable, setOllamaAvailable] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/ollama-status`)
      .then((r) => r.json())
      .then((d) => setOllamaAvailable(d.available))
      .catch(() => setOllamaAvailable(false));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!file) return null;

  // Crear set de líneas con violaciones para resaltado rápido
  const violationLines = new Map();
  for (const v of file.violations || []) {
    violationLines.set(v.line, v);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      onClick={onClose}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`File details: ${file.path}`}
        className="relative bg-surface-1 border border-surface-3 rounded-lg shadow-2xl
                    w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-3 gap-3">
          <div className="flex flex-1 items-start gap-3 min-w-0">
            <span className="min-w-0 break-all font-mono text-sm leading-relaxed text-text-primary" title={file.path}>
              {file.path}
            </span>
            <span className="text-xs text-text-muted shrink-0">
              {file.lines} lines · Score{" "}
              <span className="font-bold">{file.score}</span>
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close file details"
            className="ml-4 text-text-muted hover:text-text-primary transition-colors text-lg leading-none shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Leyenda de violaciones */}
        {file.violations?.length > 0 && (
          <div className="px-5 py-2 border-b border-surface-3 flex items-center gap-4 text-[10px] flex-wrap">
            <span className="text-text-muted">Issues:</span>
            {Object.entries(
              file.violations.reduce((acc, v) => {
                acc[v.type] = (acc[v.type] || 0) + 1;
                return acc;
              }, {})
            ).map(([type, count]) => (
              <span key={type} className="text-text-secondary">
                {TYPE_LABELS[type] || type}{" "}
                <span className="font-mono font-bold">×{count}</span>
              </span>
            ))}
          </div>
        )}

        {/* Lista de violaciones */}
        <div className="flex-1 overflow-auto p-5 space-y-3">
          {file.violations?.length > 0 ? (
            file.violations
              .sort((a, b) => a.line - b.line)
              .map((v, i) => (
                <div
                  key={i}
                  className={`rounded-md px-4 py-3 ${SEVERITY_COLORS[v.severity] || SEVERITY_COLORS.low}`}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-mono text-text-muted">
                      Line {v.line}
                      {v.column != null && `:${v.column}`}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-medium uppercase tracking-wider
                        ${v.severity === "high" ? "bg-grade-f/20 text-grade-f" : v.severity === "medium" ? "bg-grade-c/20 text-grade-c" : "bg-grade-b/20 text-grade-b"}`}
                    >
                      {v.severity}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {TYPE_LABELS[v.type] || v.type}
                    </span>
                  </div>
                  {v.context && (
                    <pre className="text-xs font-mono text-text-primary bg-surface-0/50 rounded px-3 py-2 mt-2 overflow-x-auto">
                      {v.context}
                    </pre>
                  )}
                  {ollamaAvailable && (
                    <RefactorButton
                      code={v.context}
                      violationType={v.type}
                      context={v.context}
                    />
                  )}
                  {ollamaAvailable === false && i === 0 && (
                    <p className="text-[10px] text-text-muted mt-2">💡 Install Ollama for local AI refactor suggestions</p>
                  )}
                </div>
              ))
          ) : (
            <div className="text-center py-12 text-text-muted text-sm">
              No issues found in this file 🎉
            </div>
          )}
        </div>

        {/* Deducciones */}
        {file.deductions && (
          <div className="px-5 py-3 border-t border-surface-3">
            <div className="flex items-center gap-4 text-xs flex-wrap">
              <span className="text-text-muted">Score deductions:</span>
              {Object.entries(file.deductions)
                .filter(([, v]) => v !== 0)
                .map(([key, value]) => (
                  <span key={key} className="font-mono text-text-secondary">
                    {key}:{" "}
                    <span className="text-grade-d font-bold">{value}</span>
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RefactorButton({ code, violationType, context }) {
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
    <div className="mt-2">
      {!suggestion && (
        <button
          onClick={handleRefactor}
          disabled={loading}
          className="text-[11px] px-2 py-1 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
        >
          {loading ? "⏳ Generating…" : "🤖 Suggest Refactor"}
        </button>
      )}
      {suggestion && (
        <div className="mt-2 bg-surface-0/80 rounded border border-surface-3 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2/50">
            <span className="text-[10px] text-text-muted">🤖 AI Suggestion (Ollama)</span>
            <button
              onClick={handleCopy}
              className="text-[10px] px-2 py-0.5 rounded bg-surface-3 text-text-secondary hover:bg-surface-4 transition-colors"
            >
              {copied ? "✅ Copied" : "📋 Copy"}
            </button>
          </div>
          <pre className="text-xs font-mono text-text-primary p-3 overflow-x-auto max-h-48 overflow-y-auto">
            {suggestion}
          </pre>
        </div>
      )}
    </div>
  );
}
