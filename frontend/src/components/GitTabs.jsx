/**
 * GitTabs — Sistema de tabs para alternar entre Historial y Blame.
 * Usa iconos SVG en lugar de emojis.
 */

import { useState, useEffect, lazy, Suspense, useCallback } from "react";
import { API_BASE } from "../api/client";
import { HistoryIcon, PersonIcon, WarningIcon, ErrorXIcon, LoadingIcon } from "./ui/Icons";
import { SAMPLE_JOB_ID, SAMPLE_GIT_HISTORY, SAMPLE_GIT_BLAME } from "../utils/sampleData";

const TimelineChart = lazy(() => import("./TimelineChart"));
const BlameChart = lazy(() => import("./BlameChart"));

function LazySection({ children }) {
  return (
    <Suspense fallback={<div className="card p-8 text-center"><div className="inline-flex items-center justify-center"><LoadingIcon size={24} className="text-accent" /></div><p className="text-text-muted text-xs mt-2">Loading chart...</p></div>}>
      {children}
    </Suspense>
  );
}

async function getGitErrorMessage(response) {
  const payload = await response.json().catch(() => ({}));
  const detail = payload.detail || `HTTP ${response.status}`;
  if (response.status === 404 && /job no encontrado|job not found/i.test(detail)) {
    return "This scan session has expired. Run a new repository scan to load Git insights.";
  }
  if (response.status === 400 && /no es un repositorio git|not a git repository/i.test(detail)) {
    return "Git insights are available only when scanning a Git repository.";
  }
  return detail;
}

export default function GitTabs({ jobId }) {
  const [activeTab, setActiveTab] = useState("history");
  const [history, setHistory] = useState(null);
  const [blame, setBlame] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchHistory = useCallback(async () => {
    // Demo mode: use embedded sample data instead of fetching from backend
    if (jobId === SAMPLE_JOB_ID) {
      setHistory(SAMPLE_GIT_HISTORY);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/scan/${jobId}/history?commits=5`);
      if (!res.ok) {
        throw new Error(await getGitErrorMessage(res));
      }
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, jobId]);

  const fetchBlame = useCallback(async () => {
    // Demo mode: use embedded sample data instead of fetching from backend
    if (jobId === SAMPLE_JOB_ID) {
      setBlame(SAMPLE_GIT_BLAME);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/scan/${jobId}/blame`);
      if (!res.ok) {
        throw new Error(await getGitErrorMessage(res));
      }
      const data = await res.json();
      setBlame(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, jobId]);

  useEffect(() => {
    if (activeTab === "history" && !history) fetchHistory();
    if (activeTab === "blame" && !blame) fetchBlame();
  }, [activeTab, fetchHistory, fetchBlame, history, blame]);

  const tabs = [
    { key: "history", label: "History", icon: HistoryIcon, description: "Score evolution across commits" },
    { key: "blame", label: "Blame", icon: PersonIcon, description: "Debt attributed by author" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-1 w-fit" role="tablist" aria-label="Git data views">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isSelected = activeTab === tab.key;
          const panelId = `git-tabpanel-${tab.key}`;
          return (
            <button
              key={tab.key}
              id={`git-tab-${tab.key}`}
              role="tab"
              aria-selected={isSelected}
              aria-controls={panelId}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-md text-sm font-medium interactive-transition inline-flex items-center gap-2 ${
                isSelected
                  ? "bg-surface-3 text-text-primary shadow-sm"
                  : "text-text-muted hover:text-text-secondary"
              }`}
              title={tab.description}
            >
              <TabIcon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Warning */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-3/30 rounded-md border border-surface-3">
        <WarningIcon size={16} className="text-semantic-warning shrink-0" />
        <p className="text-caption text-text-muted">
          {activeTab === "history"
            ? "This can take 1-2 minutes (analyzes each commit with stashed working directory)."
            : "This runs git blame on each analyzed file to attribute violations to authors."}
        </p>
      </div>

      {/* Content */}
      {loading && (
        <div className="card p-8 text-center space-y-3" aria-busy="true">
          <div className="inline-flex items-center justify-center">
            <LoadingIcon size={24} className="text-accent" />
          </div>
          <p className="text-text-muted text-sm">Analyzing Git data…</p>
          <p className="text-text-muted text-[10px]">This may take a minute for large repos</p>
          <div className="w-full max-w-xs mx-auto mt-2">
            <div className="h-1 bg-surface-3 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-accent rounded-full animate-shimmer" />
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="card p-6 text-center space-y-2">
          <div className="flex justify-center"><ErrorXIcon size={24} className="text-semantic-error" /></div>
          <p className="text-semantic-error text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && activeTab === "history" && history && (
        <div
          id="git-tabpanel-history"
          role="tabpanel"
          aria-labelledby="git-tab-history"
        >
          {history.error ? (
            <div className="card p-6 text-center space-y-2">
              <div className="flex justify-center"><WarningIcon size={24} className="text-semantic-warning" /></div>
              <p className="text-text-muted text-sm">{history.error}</p>
            </div>
          ) : (
            <TimelineChart commits={history.commits} />
          )}
        </div>
      )}

      {!loading && !error && activeTab === "blame" && blame && (
        <div
          id="git-tabpanel-blame"
          role="tabpanel"
          aria-labelledby="git-tab-blame"
        >
          <BlameChart blameData={blame} />
        </div>
      )}
    </div>
  );
}
