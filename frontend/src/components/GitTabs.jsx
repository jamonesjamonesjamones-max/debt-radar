/**
 * GitTabs — Sistema de tabs para alternar entre Historial y Blame.
 */

import { useState, useEffect } from "react";
import TimelineChart from "./TimelineChart";
import BlameChart from "./BlameChart";
import { API_BASE } from "../api/client";

export default function GitTabs({ jobId }) {
  const [activeTab, setActiveTab] = useState("history");
  const [history, setHistory] = useState(null);
  const [blame, setBlame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchHistory = async () => {
    if (history || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/scan/${jobId}/history?commits=5`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBlame = async () => {
    if (blame || loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/scan/${jobId}/blame`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setBlame(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history" && !history) fetchHistory();
    if (activeTab === "blame" && !blame) fetchBlame();
  }, [activeTab]);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "history"
              ? "bg-surface-3 text-text-primary"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          🕐 History
        </button>
        <button
          onClick={() => setActiveTab("blame")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === "blame"
              ? "bg-surface-3 text-text-primary"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          👤 Blame
        </button>
      </div>

      {/* Warning */}
      <p className="text-xs text-text-muted">
        ⚠️ {activeTab === "history"
          ? "This can take 1-2 minutes (analyzes each commit)."
          : "This runs git blame on each analyzed file."}
      </p>

      {/* Content */}
      {loading && (
        <div className="card p-8 text-center">
          <div className="animate-spin inline-block w-8 h-8 border-2 border-surface-3 border-t-accent rounded-full" />
          <p className="text-text-muted text-sm mt-3">Analyzing…</p>
        </div>
      )}

      {error && (
        <div className="card p-4 text-center">
          <p className="text-grade-f text-sm">❌ {error}</p>
        </div>
      )}

      {!loading && !error && activeTab === "history" && history && (
        <>
          {history.error ? (
            <div className="card p-4 text-center">
              <p className="text-text-muted text-sm">{history.error}</p>
            </div>
          ) : (
            <TimelineChart commits={history.commits} />
          )}
        </>
      )}

      {!loading && !error && activeTab === "blame" && blame && (
        <BlameChart blameData={blame} />
      )}
    </div>
  );
}
