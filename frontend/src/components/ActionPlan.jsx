/**
 * ActionPlan - Prioritized list of files to refactor, ranked by impact/effort ratio.
 */

import { useState, useEffect, memo } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "../api/client";
import { shortenPath } from "../utils/paths";
import InfoTooltip from "./ui/InfoTooltip";
import StatusPill from "./ui/StatusPill";
import { LoadingIcon, ErrorXIcon, LightbulbIcon, ArrowRightIcon } from "./ui/Icons";

const PRIORITY_CONFIG = {
  critical: { label: "Critical", color: "text-semantic-error", bg: "bg-semantic-error-bg" },
  high: { label: "High", color: "text-semantic-warning", bg: "bg-semantic-warning-bg" },
  medium: { label: "Medium", color: "text-grade-c", bg: "bg-grade-c-bg" },
  low: { label: "Low", color: "text-text-muted", bg: "bg-surface-3/30" },
};

const ActionPlan = memo(function ActionPlan({ jobId, onSelectFile }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    fetch(API_BASE + "/api/scan/" + jobId + "/recommendations")
      .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [jobId]);

  if (loading) {
    return (
      <div className="card-premium p-6 text-center space-y-3 animate-fade-in">
        <LoadingIcon size={24} className="text-accent" />
        <p className="text-text-muted text-sm">Prioritizing recommendations...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-premium p-6 text-center space-y-3 animate-fade-in">
        <ErrorXIcon size={24} className="text-semantic-error" />
        <p className="text-text-muted text-sm">Could not load recommendations: {error}</p>
      </div>
    );
  }

  if (!data || !data.recommendations || data.recommendations.length === 0) return null;

  const { summary, recommendations } = data;

  return (
    <div className="card-premium overflow-hidden animate-card-enter">
      <div className="px-5 py-4 border-b border-surface-3">
        <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3">
          <div>
            <h3 className="section-header flex items-center gap-1.5">
              <LightbulbIcon size={16} className="text-semantic-warning" />
              Action Plan
              <InfoTooltip text="Files ranked by impact per minute of effort. Start with Critical and High files for the best return on investment." side="bottom" />
            </h3>
            <p className="text-caption text-text-muted mt-0.5">Prioritized by impact ratio (score gain / effort)</p>
          </div>
          <div className="flex items-center gap-3 text-eyebrow text-text-muted">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-semantic-error" />{summary.critical_count} critical</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-semantic-warning" />{summary.high_count} high</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-grade-c" />{summary.medium_count} medium</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4 flex-wrap text-[10px] text-text-muted">
          <span><span className="font-mono font-bold text-text-primary">{summary.max_potential_gain}</span> pts potential gain</span>
          <span className="w-1 h-1 rounded-full bg-surface-4" />
          <span><span className="font-mono font-bold text-text-primary">{summary.total_estimated_effort_minutes >= 60 ? (summary.total_estimated_effort_minutes / 60).toFixed(1) + "h" : Math.round(summary.total_estimated_effort_minutes) + "m"}</span> estimated effort</span>
          <span className="w-1 h-1 rounded-full bg-surface-4" />
          <span><span className="font-mono font-bold text-text-primary">{summary.total_files_analyzed}</span> files analyzed</span>
        </div>
      </div>

      <div className="divide-y divide-surface-3/50">
        {recommendations.map((rec, i) => {
          const config = PRIORITY_CONFIG[rec.priority_label] || PRIORITY_CONFIG.low;
          const effortDisplay = rec.estimated_effort_minutes >= 60 ? (rec.estimated_effort_minutes / 60).toFixed(1) + "h" : Math.round(rec.estimated_effort_minutes) + "m";
          return (
            <motion.div key={rec.file_path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.6) }}
              className="px-5 py-3 interactive-transition hover:bg-surface-3/20 cursor-pointer"
              onClick={() => { if (onSelectFile) onSelectFile(rec.file_path); }}
              onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && onSelectFile) { e.preventDefault(); onSelectFile(rec.file_path); } }}
              tabIndex={0} role="button" aria-label={"Recommendation for " + rec.file_path}
            >
              <div className="flex items-start gap-3">
                <span className="text-caption text-text-muted font-mono mt-0.5 shrink-0">#{i + 1}</span>
                <span className={"inline-flex items-center px-2 py-0.5 rounded-pill text-[9px] font-bold uppercase tracking-wider " + config.color + " " + config.bg}>{config.label}</span>
                <div className="flex-1 min-w-0">
                  <span className="block font-mono text-xs text-text-primary break-all" title={rec.file_path}>{shortenPath(rec.file_path, 4)}</span>
                  <p className="text-[10px] text-text-muted mt-0.5">{rec.reason}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-right">
                  <div className="hidden sm:block"><p className="text-caption text-text-muted">Effort</p><p className="text-xs font-mono font-bold text-text-primary">{effortDisplay}</p></div>
                  <div><p className="text-caption text-text-muted">Gain</p><p className="text-xs font-mono font-bold text-semantic-success">+{rec.score_gain}</p></div>
                  <ArrowRightIcon size={14} className="text-text-muted shrink-0" />
                </div>
              </div>
              {rec.top_violations && rec.top_violations.length > 0 && (
                <div className="mt-2 ml-7 flex items-center gap-1.5 flex-wrap">
                  {rec.top_violations.map((v, vi) => <StatusPill key={vi} type={v.type} count={1} />)}
                  <span className="text-[9px] text-text-muted ml-1">Click to inspect</span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
});

export default ActionPlan;
