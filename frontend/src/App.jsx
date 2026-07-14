import { useState } from "react";
import TopNav from "./components/TopNav";
import Dashboard from "./components/Dashboard";
import LoadingState from "./components/LoadingState";
import EmptyStates from "./components/EmptyStates";
import OnboardingModal from "./components/OnboardingModal";
import ErrorBoundary from "./components/ErrorBoundary";
import { useAnalysis } from "./hooks/useAnalysis";

export default function App() {
  const [path, setPath] = useState("");
  const [workers, setWorkers] = useState(4);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const { state, data, progress, error, errorStatus, jobId, startScan, reset } = useAnalysis();

  const handleScan = () => {
    if (!path.trim()) return;
    startScan(path.trim(), workers);
  };

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
      <TopNav
        path={path}
        setPath={setPath}
        workers={workers}
        setWorkers={setWorkers}
        onScan={handleScan}
        onReset={reset}
        scanning={state === "scanning"}
      />

      <main className="flex-1 overflow-auto">
        {state === "idle" && <EmptyStates.Idle />}

        {state === "scanning" && <LoadingState progress={progress} />}

        {state === "error" && (
          errorStatus === 400
            ? <EmptyStates.ScanTooLarge />
            : <EmptyStates.Error error={error} onRetry={handleScan} />
        )}

        {state === "empty" && <EmptyStates.NoFiles path={path} />}

        {state === "done" && data && (
          <ErrorBoundary onReset={reset}>
            <Dashboard data={data} jobId={jobId} />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}
