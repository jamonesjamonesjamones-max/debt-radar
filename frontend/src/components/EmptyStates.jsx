/**
 * EmptyStates — Empty states: Idle, NoFiles, ScanTooLarge, Error.
 */

function Idle() {
  return (
    <div className="max-w-lg mx-auto px-6 py-32 text-center space-y-4">
      <div className="text-5xl">📡</div>
      <h2 className="text-xl font-semibold text-text-primary">
        Paste your project path
      </h2>
      <p className="text-text-secondary text-sm leading-relaxed">
        DebtRadar will analyze your repository and show you an architectural
        health diagnosis: cyclomatic complexity, monolithic files, accumulated
        TODOs and magic numbers.
      </p>
      <p className="text-text-muted text-xs">
        Supports Python, JavaScript and TypeScript. 100% local, your code never
        leaves your machine.
      </p>
    </div>
  );
}

function NoFiles({ path }) {
  return (
    <div className="max-w-lg mx-auto px-6 py-32 text-center space-y-4">
      <div className="text-5xl">📂</div>
      <h2 className="text-xl font-semibold text-text-primary">
        No analyzable files
      </h2>
      <p className="text-text-secondary text-sm">
        No <code>.py</code>, <code>.js</code>, <code>.ts</code> or{" "}
        <code>.tsx</code> files found in:
      </p>
      <p className="text-text-muted text-xs font-mono break-all">{path}</p>
    </div>
  );
}

function ScanTooLarge({ fileCount }) {
  return (
    <div className="max-w-lg mx-auto px-6 py-32 text-center space-y-4">
      <div className="text-5xl">⚠️</div>
      <h2 className="text-xl font-semibold text-text-primary">
        Repository too large
      </h2>
      <p className="text-text-secondary text-sm">
        {fileCount ? (
          <>
            Found{" "}
            <span className="font-mono text-accent">{fileCount}</span> files.
          </>
        ) : (
          "The repository exceeds the file limit."
        )}
        {" "}Select a more specific subfolder to scan.
      </p>
    </div>
  );
}

function Error({ error, onRetry }) {
  return (
    <div className="max-w-lg mx-auto px-6 py-32 text-center space-y-4">
      <div className="text-5xl">💥</div>
      <h2 className="text-xl font-semibold text-text-primary">
        Scan error
      </h2>
      <p className="text-text-secondary text-sm font-mono bg-surface-2 border border-surface-3 rounded-md px-4 py-3 text-left">
        {error}
      </p>
      <button
        onClick={onRetry}
        className="px-5 py-2.5 rounded-md text-sm font-medium
                   bg-accent text-white hover:bg-accent-hover transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

const EmptyStates = { Idle, NoFiles, ScanTooLarge, Error };
export default EmptyStates;
