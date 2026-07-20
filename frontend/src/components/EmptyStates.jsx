/**
 * EmptyStates — Estados vacíos profesionales: Idle, NoFiles, ScanTooLarge, Error.
 * Usa iconos SVG en lugar de emojis para una apariencia más profesional.
 */

import { useState } from "react";
import EmptyStateComponent from "./ui/EmptyState";
import { FolderIcon, WarningIcon, BoomIcon, LightbulbIcon, CopyIcon, CheckIcon } from "./ui/Icons";

function Idle() {
  return (
    <div className="animate-fade-in">
      <EmptyStateComponent
        icon={
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block">
            <circle cx="32" cy="32" r="28" stroke="#222228" strokeWidth="2" fill="none" />
            <circle cx="32" cy="32" r="12" fill="#6366f1" fillOpacity="0.15" stroke="#6366f1" strokeWidth="1.5" />
            <path d="M32 24v8l6 4" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" />
            <path d="M20 20l4 4M44 20l-4 4M20 44l4-4M44 44l-4-4" stroke="#222228" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        }
        title="Enter a project path to start"
        description={
          <>
            DebtRadar will analyze your repository and show you an architectural
            health diagnosis: cyclomatic complexity, monolithic files, accumulated
            TODOs and magic numbers. Then it gives you a grade from <strong className="text-grade-a">A</strong> (Clean) to <strong className="text-grade-f">F</strong> (Biohazard).
          </>
        }
        hint="Supports Python, JavaScript and TypeScript. 100% local — your code never leaves your machine."
      />
    </div>
  );
}

function NoFiles({ path }) {
  return (
    <div className="animate-fade-in">
      <EmptyStateComponent
        icon={<FolderIcon size={40} className="text-text-muted" />}
        title="No analyzable files"
        description={
          <>
            No <code className="text-accent font-mono px-1">.py</code>, <code className="text-accent font-mono px-1">.js</code>,{" "}
            <code className="text-accent font-mono px-1">.ts</code> or{" "}
            <code className="text-accent font-mono px-1">.tsx</code> files found.
            The folder may contain only binaries, assets, or unsupported languages.
          </>
        }
        hint={path ? `Path scanned: ${path}` : undefined}
        action={
          <span className="text-text-muted text-xs inline-flex items-center gap-1.5">
            <LightbulbIcon size={14} className="opacity-60" />
            Try a different subfolder or check that the path is correct.
          </span>
        }
      />
    </div>
  );
}

function ScanTooLarge({ fileCount }) {
  return (
    <div className="animate-fade-in">
      <EmptyStateComponent
        icon={<WarningIcon size={40} className="text-semantic-warning" />}
        title="Repository too large"
        description={
          <>
            {fileCount ? (
              <>
                Found <span className="font-mono text-accent font-bold">{fileCount}</span> files —
                DebtRadar supports a maximum of{" "}
                <span className="font-mono">5,000 files</span> per scan.
              </>
            ) : (
              "The repository exceeds the file limit."
            )}
          </>
        }
        action={
          <span className="text-text-muted text-xs inline-flex items-center gap-1.5">
            <LightbulbIcon size={14} className="opacity-60" />
            Select a specific subfolder to scan instead of the whole repository.
          </span>
        }
        technical={fileCount ? `Total files found: ${fileCount}\nMax supported: 5,000\nTip: Use a subfolder path to narrow the scan scope.` : undefined}
      />
    </div>
  );
}

function Error({ error, onRetry }) {
  const [copied, setCopied] = useState(false);

  const handleCopyError = async () => {
    if (!error) return;
    try {
      await navigator.clipboard.writeText(error);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="animate-fade-in">
      <EmptyStateComponent
        icon={<BoomIcon size={40} className="text-semantic-error" />}
        title="Scan failed"
        description="The scanner encountered an error while processing the request."
        action={
          <div className="flex items-center gap-3 justify-center">
            <button onClick={onRetry} className="btn-primary btn-sm btn-magnetic">
              Retry scan
            </button>
            {error && (
              <button onClick={handleCopyError} className="btn-secondary btn-sm">
                {copied ? <CheckIcon size={14} className="text-semantic-success" /> : <CopyIcon size={14} />}
                <span>{copied ? "Copied" : "Copy error"}</span>
              </button>
            )}
          </div>
        }
        technical={error}
      />
    </div>
  );
}

const EmptyStates = { Idle, NoFiles, ScanTooLarge, Error };
export default EmptyStates;
