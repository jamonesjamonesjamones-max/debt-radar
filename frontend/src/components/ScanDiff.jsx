/**
 * ScanDiff — Side-by-side comparison between two scans.
 * Shows which files improved, regressed, or stayed the same.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "../api/client";
import { shortenPath } from "../utils/paths";
import { LoadingIcon, ErrorXIcon, ChartIcon } from "./ui/Icons";

const STATUS_CONFIG = {
  regressed: { label: "Regressed", color: "text-semantic-error", bg: "bg-semantic-error-bg", border: "border-l-semantic-error" },
  improved: { label: "Improved", color: "text-semantic-success", bg: "bg-semantic-success-bg", border: "border-l-semantic-success" },
  new: { label: "New", color: "text-accent", bg: "bg-accent/10", border: "border-l-accent" },
  unchanged: { label: "Unchanged", color: "text-text-muted", bg: "bg-surface-3/20", border: "border-l-text-muted" },
  removed: { label: "Removed", color: "text-text-muted", bg: "bg-surface-3/20", border: "border-l-text-muted" },
};

export default function ScanDiff({ jobId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!jobId) return;
    setLoading(true);
    fetch(API_BASE + "/api/scan/" + jobId + "/diff")
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [jobId]);

  if (loading) {
    return (
      <div className="card-premium p-6 text-center space-y-3">
        <LoadingIcon size={24} className="text-accent" />
        <p className="text-text-muted text-sm">Comparing scans...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-premium p-6 text-center space-y-3">
        <ErrorXIcon size={24} className="text-semantic-error" />
        <p className="text-text-muted text-sm">Comparison unavailable: {error}</p>
      </div>
    );
  }

  if (!data || data.error) {
    if (data && data.comparison) {
      return (
        <div className={"card px-5 py-4 flex items-center gap-4 border-l-2 " + (
          data.comparison.trend === "improving" ? "border-l-semantic-success" : 
          data.comparison.trend === "declining" ? "border-l-semantic-error" : "border-l-text-muted"
        )}>
          <ChartIcon size={20} className="text-text-muted" />
          <div>
            <p className="text-sm font-medium text-text-primary">
              {data.comparison.trend === "improving" ? "Improving" : data.comparison.trend === "declining" ? "Declining" : "Stable"}
            </p>
            <p className="text-xs text-text-muted">
              Score: {data.comparison.score_diff > 0 ? "+" : ""}{data.comparison.score_diff} pts
              vs last scan
            </p>
          </div>
          <span className="text-xs text-text-muted font-mono">
            Run another scan and compare using ?against={"{job_id}"}
          </span>
        </div>
      );
    }
    return null;
  }

  if (!data.diffs || data.diffs.length === 0) return null;

  const summary = data.summary;
  const hasChanges = summary.regressed > 0 || summary.improved > 0 || summary.new_files > 0;

  return (
    <div className="card-premium overflow-hidden animate-card-enter">
      <div className="px-5 py-4 border-b border-surface-3">
        <h3 className="section-header flex items-center gap-1.5">
          <ChartIcon size={16} className="text-text-muted" />
          Changes from Previous Scan
        </h3>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-text-muted">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-semantic-success" />
            {summary.improved} improved
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-semantic-error" />
            {summary.regressed} regressed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-accent" />
            {summary.new_files} new
          </span>
          <span>{summary.total_violations_removed} violations fixed</span>
          <span>{summary.total_violations_added} violations added</span>
        </div>
      </div>

      <div className="divide-y divide-surface-3/50 max-h-96 overflow-y-auto">
        {data.diffs.filter(function(d) { return hasChanges ? d.status !== "unchanged" : true; }).map(function(d, i) {
          var config = STATUS_CONFIG[d.status] || STATUS_CONFIG.unchanged;
          return (
            <motion.div key={d.file_path} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
              className={"px-5 py-3 border-l-2 " + config.border + " interactive-transition hover:bg-surface-3/20"}>
              <div className="flex items-start gap-3">
                <span className={"inline-flex items-center px-2 py-0.5 rounded-pill text-[9px] font-bold uppercase tracking-wider " + config.color + " " + config.bg}>
                  {config.label}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="block font-mono text-xs text-text-primary break-all">{shortenPath(d.file_path, 4)}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-right">
                  <span className={"text-xs font-mono font-bold " + (d.score_change > 0 ? "text-semantic-success" : d.score_change < 0 ? "text-semantic-error" : "text-text-muted")}>
                    {d.score_change > 0 ? "+" : ""}{d.score_change}
                  </span>
                  <span className="text-caption text-text-muted">{d.current_score}</span>
                </div>
              </div>
              <div className="mt-2 ml-12 flex items-center gap-1.5 flex-wrap">
                {d.violations_added_count > 0 && (
                  <span className="text-[9px] text-semantic-error">+{d.violations_added_count} violations</span>
                )}
                {d.violations_removed_count > 0 && (
                  <span className="text-[9px] text-semantic-success">-{d.violations_removed_count} violations</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
