import { useState, useRef, useEffect, lazy, Suspense, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import TopNav from "./components/TopNav";
import LoadingState from "./components/LoadingState";
import EmptyStates from "./components/EmptyStates";
import OnboardingModal from "./components/OnboardingModal";
import ErrorBoundary from "./components/ErrorBoundary";
import FileDropZone from "./components/FileDropZone";
import { useAnalysis } from "./hooks/useAnalysis";
import ConfettiOverlay from "./components/ui/ConfettiOverlay";
import FeedbackWidget from "./components/FeedbackWidget";

const Dashboard = lazy(() => import("./components/Dashboard"));
const PortfolioDashboard = lazy(() => import("./components/PortfolioDashboard"));

export default function App() {
  const [showConfetti, setShowConfetti] = useState(false);
  const [path, setPath] = useState("");
  const [workers, setWorkers] = useState(4);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const { state, data, progress, error, errorStatus, jobId, analysisSource, startScan, loadDemo, startUpload, reset } = useAnalysis();

  // Dynamic page title with live progress percentage
  useEffect(() => {
    if (state === "scanning" && progress?.percent != null) {
      document.title = `${Math.round(progress.percent)}% Scanning | DebtRadar`;
    } else if (state === "scanning") {
      document.title = "Scanning... | DebtRadar";
    } else if (state === "uploading") {
      document.title = "Uploading & Analyzing | DebtRadar";
    } else if (state === "done") {
      document.title = `Results ${data?.summary?.grade || ""} | DebtRadar`;
    } else {
      document.title = "DebtRadar — Code Health Auditor";
    }
  }, [state, progress?.percent, data?.summary?.grade]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.key === "Enter" && state === "idle" && path.trim()) {
        handleScan();
      }
      if (e.key === "Escape" && (state === "done" || state === "error" || state === "empty" || state === "uploading")) {
        // Cuando hay resultados visibles (state === "done"), pedir confirmación
        // para evitar que un Escape accidental borre todo el escaneo.
        // En estados error/empty/uploading no hay datos que perder.
        if (state !== "done" || window.confirm("Reset the current results? All scan data will be cleared.")) {
          reset();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state, path, workers]);
  const prevState = useRef("idle");

  // Fire confetti when scan completes successfully
  useEffect(() => {
    if (prevState.current === "scanning" && state === "done") {
      setShowConfetti(true);
    }
    prevState.current = state;
  }, [state]);

  // Portfolio view state
  const [showPortfolio, setShowPortfolio] = useState(false);
  const handleSelectPath = useCallback((scanPath) => {
    setPath(scanPath);
    setShowPortfolio(false);
    startScan(scanPath, workers);
  }, [workers, startScan]);

  // Feedback widget: show 5s after scan completes
  const [feedbackShown, setFeedbackShown] = useState(false);
  useEffect(() => {
    if (state === "done" && data && !feedbackShown) {
      const timer = setTimeout(() => setFeedbackShown(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [state, data, feedbackShown]);

  // Auto-scroll to results when scan completes
  const resultsRef = useRef(null);
  useEffect(() => {
    if (state === "done" && data) {
      const timer = setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [state, data]);

  const handleShowTutorial = () => {
    setShowOnboarding(true);
  };

  const handleScan = () => {
    if (!path.trim()) return;
    startScan(path.trim(), workers);
  };

  const handleUploadFile = useCallback((file) => {
    startUpload(file);
  }, [startUpload]);

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      {/* Skip to main content link — visible on focus for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>

      <ConfettiOverlay show={showConfetti} onDone={() => setShowConfetti(false)} />
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {state === "done" && <span>Scan complete. Showing results.</span>}
        {state === "error" && <span>Scan failed. See error details.</span>}
        {state === "empty" && <span>No files found in selected path.</span>}
        {state === "scanning" && progress && <span>Scan in progress: {Math.round(progress.percent || 0)} percent complete.</span>}
        {state === "uploading" && <span>Analyzing uploaded file.</span>}
      </div>
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
        onShowTutorial={handleShowTutorial}
        scanning={state === "scanning"}
        autoFocus={state === "idle"}
        onShowPortfolio={() => setShowPortfolio(true)}
      />

      <main id="main-content" className="flex-1 overflow-auto" tabIndex={-1}>
        <AnimatePresence mode="wait">
        {showPortfolio && (
          <motion.div key="portfolio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Suspense fallback={<div className="h-48 flex items-center justify-center"><LoadingState progress={{ percent: 0, elapsed: 0, filesCompleted: 0, totalFiles: 0 }} /></div>}>
              <PortfolioDashboard onSelectPath={handleSelectPath} />
            </Suspense>
          </motion.div>
        )}
        {!showPortfolio && state === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            role="region" aria-label="Welcome screen"
          >
            <EmptyStates.Idle onLoadDemo={loadDemo} />
            <div className="max-w-2xl mx-auto px-6 pb-8">
              <div className="relative flex items-center gap-3 py-4">
                <div className="flex-1 h-px bg-surface-4" />
                <span className="text-[10px] text-text-muted uppercase tracking-wider">or upload a file</span>
                <div className="flex-1 h-px bg-surface-4" />
              </div>
              <FileDropZone onFileSelected={handleUploadFile} disabled={false} />
            </div>
          </motion.div>
        )}

        {state === "uploading" && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            role="region" aria-label="File analysis progress"
          >
            <LoadingState progress={progress} />
          </motion.div>
        )}

        {state === "scanning" && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            role="region" aria-label="Scan progress"
          >
            <LoadingState progress={progress} />
          </motion.div>
        )}

        {state === "error" && (
          errorStatus === 400
            ? <EmptyStates.ScanTooLarge />
            : <EmptyStates.Error error={error} onRetry={handleScan} />
        )}

        {state === "empty" && <EmptyStates.NoFiles path={path} />}

        {state === "done" && data && (
          <motion.div
            key="done"
            ref={resultsRef}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            role="region" aria-label="Scan results"
          >
            <ErrorBoundary onReset={reset}>
            <Suspense fallback={<div className="h-96 flex items-center justify-center" role="status" aria-label="Loading results"><LoadingState progress={{ percent: 0, elapsed: 0, filesCompleted: 0, totalFiles: 0 }} /></div>}>
              <Dashboard data={data} jobId={jobId} analysisSource={analysisSource} />
            </Suspense>
          </ErrorBoundary>
          </motion.div>
        )}

        {state === "done" && feedbackShown && (
          <div className="max-w-7xl mx-auto px-6 pb-6">
            <FeedbackWidget scanGrade={data?.summary?.grade} onDismiss={() => setFeedbackShown(false)} />
          </div>
        )}
      </AnimatePresence>
      </main>
    </div>
  );
}
