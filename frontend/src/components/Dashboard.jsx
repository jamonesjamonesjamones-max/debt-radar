/**
 * Dashboard — Contenedor principal que orquesta todos los componentes de visualización.
 */

import SummaryBar from "./SummaryBar";
import HeatMap from "./HeatMap";
import RadarChart from "./RadarChart";
import HallOfShame from "./HallOfShame";
import CodeViewer from "./CodeViewer";
import GitTabs from "./GitTabs";
import ScanHistory from "./ScanHistory";
import { useState } from "react";
import { shortenPath } from "../utils/paths";

export default function Dashboard({ data, jobId }) {
  const [selectedFile, setSelectedFile] = useState(null);

  const { summary, files = [], skipped_files = [] } = data;

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
      {/* Resumen superior */}
      <SummaryBar summary={summary} jobId={jobId} />

      {/* Scan history + comparison */}
      {data.comparison && (
        <ScanHistory path={data.summary?.scan_path} comparison={data.comparison} />
      )}

      {/* Grid principal: Treemap + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <HeatMap files={files} onSelect={setSelectedFile} />
        </div>
        <div>
          <RadarChart files={files} />
        </div>
      </div>

      {/* Hall of Shame */}
      <HallOfShame files={files} onSelect={setSelectedFile} />

      {/* Git Integrations: Historial + Blame */}
      {jobId && <GitTabs jobId={jobId} />}

      {/* Archivos skipped */}
      {skipped_files.length > 0 && (
        <div className="card px-5 py-4">
          <h3 className="text-sm font-medium text-text-secondary mb-2">
            Skipped files ({skipped_files.length})
          </h3>
          <div className="space-y-1">
            {skipped_files.map((sf, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="block break-all font-mono text-text-secondary" title={sf.path}>
                    {shortenPath(sf.path, 4)}
                  </span>
                  {shortenPath(sf.path, 4) !== sf.path && (
                    <span className="mt-0.5 block break-all font-mono text-[10px] leading-relaxed text-text-muted">
                      {sf.path}
                    </span>
                  )}
                </div>
                <span className="shrink-0 text-text-muted">{sf.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Code Viewer Modal */}
      {selectedFile && (
        <CodeViewer file={selectedFile} onClose={() => setSelectedFile(null)} />
      )}
    </div>
  );
}
