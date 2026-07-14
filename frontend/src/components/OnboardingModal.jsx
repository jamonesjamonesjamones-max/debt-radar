/**
 * OnboardingModal — Modal de bienvenida de 4 pasos para nuevos usuarios.
 * Se muestra solo la primera vez (localStorage).
 */

import { useState, useEffect } from "react";

const STORAGE_KEY = "debtradar-onboarding";

const STEPS = [
  {
    title: "📡 Welcome to DebtRadar",
    content:
      "DebtRadar is a forensic code health auditor that analyzes your repository and tells you where the architectural problems are. It's 100% local — your code never leaves your machine.",
  },
  {
    title: "📂 Paste Your Project Path",
    content:
      'In the top bar, paste the absolute path of your project. Examples:\n\n• C:\\Users\\you\\my-project (Windows)\n• ~/Documents/my-project (Mac/Linux)\n• /home/user/projects/my-app\n• /workspace (Docker)\n\nWhen running with Docker, the selected host folder is mounted read-only at /workspace, so enter /workspace here. You can also use relative paths like "." for the current directory when running locally.',
  },
  {
    title: "⚡ Adjust Parallelism",
    content:
      'Use the "Workers" slider to control how many files are analyzed in parallel:\n\n• 🐢 1 worker: Low CPU impact\n• ⚡ 4 workers: Balanced (recommended)\n• 🚀 8 workers: Maximum speed\n\nMore workers = faster, but uses more CPU.',
  },
  {
    title: "🚀 Start Scanning",
    content:
      "Click 'Start Scan' and you will see:\n\n• ⏱️ A timer showing elapsed time\n• 📊 A real-time progress bar\n• 📁 The file currently being analyzed\n\nWhen done, you will see the Dashboard with the grade (A-F), a Heat Treemap, a Debt Radar, and the most problematic files table.",
  },
];

export default function OnboardingModal({ isOpen, onClose }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Si ya vio el onboarding, no mostrar
    if (typeof window !== "undefined") {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (seen) {
        onClose();
      }
    }
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") handleSkip();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // localStorage no disponible
    }
    onClose();
  };

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="relative bg-surface-2 border border-surface-3 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div className="flex h-1 bg-surface-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`flex-1 transition-colors duration-300 ${
                i <= step ? "bg-accent" : "bg-surface-3"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Step indicator */}
          <div className="text-xs text-text-muted mb-4">
            Step {step + 1} of {STEPS.length}
          </div>

          {/* Title */}
          <h2 id="onboarding-title" className="text-2xl font-bold text-text-primary mb-4">
            {current.title}
          </h2>

          {/* Content */}
          <div className="text-text-secondary text-sm leading-relaxed whitespace-pre-line min-h-[160px]">
            {current.content}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-8 py-4 border-t border-surface-3">
          <button
            onClick={handleSkip}
            className="text-sm text-text-muted hover:text-text-secondary transition-colors"
          >
            Skip tutorial
          </button>

          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 rounded-md text-sm font-medium bg-surface-3 text-text-secondary hover:bg-surface-4 transition-colors"
              >
                Previous
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-6 py-2 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent-hover transition-colors"
            >
              {step === STEPS.length - 1 ? "🚀 Get Started" : "Next →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
