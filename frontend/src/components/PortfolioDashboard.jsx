/**
 * PortfolioDashboard — Shows latest scan for every project.
 * Useful for teams managing multiple microservices.
 */

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { API_BASE } from "../api/client";
import { LoadingIcon, ErrorXIcon, FolderIcon } from "./ui/Icons";

const GRADE_COLORS = {
  A: "text-grade-a bg-grade-a-bg",
  B: "text-grade-b bg-grade-b-bg",
  C: "text-grade-c bg-grade-c-bg",
  D: "text-grade-d bg-grade-d-bg",
  F: "text-grade-f bg-grade-f-bg",
};

export default function PortfolioDashboard({ onSelectPath }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortBy, setSortBy] = useState("score");

  useEffect(() => {
    setLoading(true);
    fetch(API_BASE + "/api/scan/all-projects")
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, []);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 text-center space-y-3">
        <LoadingIcon size={24} className="text-accent" />
        <p className="text-text-muted text-sm">Loading portfolio...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 text-center space-y-3">
        <ErrorXIcon size={24} className="text-semantic-error" />
        <p className="text-text-muted text-sm">{error}</p>
      </div>
    );
  }

  if (!data || data.projects.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 text-center space-y-3">
        <FolderIcon size={32} className="text-text-muted" />
        <p className="text-text-muted text-sm">No projects scanned yet.</p>
        <p className="text-text-muted text-xs">Run a scan to see it here.</p>
      </div>
    );
  }

  const projects = [...data.projects];

  if (sortBy === "score") {
    projects.sort(function(a, b) { return a.score - b.score; });
  } else if (sortBy === "name") {
    projects.sort(function(a, b) { return a.path.localeCompare(b.path); });
  } else if (sortBy === "date") {
    projects.sort(function(a, b) { return b.created_at.localeCompare(a.created_at); });
  }

  const headerStyle = "px-3 py-2 text-[10px] font-medium text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-secondary interactive-transition";

  return (
    <div className="card-premium overflow-hidden animate-card-enter">
      <div className="px-5 py-4 border-b border-surface-3">
        <h3 className="section-header">Portfolio Overview</h3>
        <p className="text-caption text-text-muted mt-0.5">
          {data.total} project{data.total !== 1 ? "s" : ""} tracked
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" role="table" aria-label="Portfolio overview">
          <thead>
            <tr className="border-b border-surface-3">
              <th scope="col" className={headerStyle} onClick={function() { setSortBy("name"); }}>Project</th>
              <th scope="col" className={headerStyle + " text-center"} onClick={function() { setSortBy("score"); }}>Grade</th>
              <th scope="col" className={headerStyle + " text-right"} onClick={function() { setSortBy("score"); }}>Score</th>
              <th scope="col" className={headerStyle + " text-right"}>Files</th>
              <th scope="col" className={headerStyle + " text-right"}>Issues</th>
              <th scope="col" className={headerStyle + " text-right hidden sm:table-cell"} onClick={function() { setSortBy("date"); }}>Last scan</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(function(p, i) {
              var gradeColor = GRADE_COLORS[p.grade] || GRADE_COLORS.F;
              return (
                <motion.tr key={p.path}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={function() { if (onSelectPath) onSelectPath(p.path); }}
                  className="border-b border-surface-3/50 last:border-0 hover:bg-surface-3/20 cursor-pointer interactive-transition"
                >
                  <td className="px-3 py-3">
                    <span className="font-mono text-xs text-text-primary break-all">{p.path}</span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <span className={"inline-flex items-center justify-center w-6 h-6 rounded-md text-[10px] font-bold font-mono " + gradeColor}>
                      {p.grade}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-xs text-text-primary">{p.score}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-text-secondary">{p.total_files}</td>
                  <td className="px-3 py-3 text-right font-mono text-xs text-text-secondary">{p.total_violations}</td>
                  <td className="px-3 py-3 text-right font-mono text-[10px] text-text-muted hidden sm:table-cell">
                    {p.created_at ? p.created_at.slice(0, 10) : "N/A"}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
