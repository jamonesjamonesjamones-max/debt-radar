/**
 * OnboardingModal — Experiencia de 4 pasos visual y profesional.
 * Se muestra solo la primera vez (localStorage).
 * Todos los iconos son SVG en lugar de emojis.
 */

import { useState, useEffect } from "react";
import { RadarIcon, FolderIcon, RocketIcon, SparklesIcon, LightbulbIcon, ArrowRightIcon } from "./ui/Icons";

const STORAGE_KEY = "debtradar-onboarding";

const STEPS = [
  {
    icon: RadarIcon,
    title: "Welcome to DebtRadar",
    subtitle: "Forensic Code Health Auditor",
    content:
      "DebtRadar analyzes your repository and quantifies technical debt — monolithic files, cyclomatic complexity, TODOs, and magic numbers. It's 100% local. Your code never leaves your machine.",
    highlights: [
      "Scans Python, JavaScript, TypeScript",
      "100% local — no data sent externally",
      "Visual dashboard with actionable insights",
    ],
  },
  {
    icon: FolderIcon,
    title: "Enter Your Project Path",
    subtitle: "Where to point the scanner",
    content:
      "Paste the absolute path to your project in the input field at the top.",
    examples: [
      { label: "Windows", value: "C:\\Users\\you\\my-project" },
      { label: "Mac / Linux", value: "/home/user/projects/my-app" },
      { label: "Docker", value: "/workspace" },
    ],
    note: "In Docker mode, the project folder is mounted read-only at /workspace. Use that path.",
  },
  {
    icon: RocketIcon,
    title: "Adjust Performance",
    subtitle: "Parallel workers slider",
    content:
      "Control how many files DebtRadar analyzes simultaneously. More workers = faster scan, more CPU usage.",
    highlights: [
      "1 worker — Minimal CPU impact",
      "4 workers — Balanced (recommended)",
      "8 workers — Maximum speed",
    ],
  },
  {
    icon: SparklesIcon,
    title: "Analyze & Act",
    subtitle: "From scan to refactoring",
    content:
      "Click 'Start Scan' and watch real-time progress. When complete, the Dashboard shows you:",
    highlights: [
      "Overall grade (A–F) with score distribution",
      "Heat treemap of file sizes and scores",
      "Hall of Shame — worst offenders ranked",
      "Git integration — blame and history",
      "Optional AI refactor suggestions (Ollama)",
    ],
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
  const isLast = step === STEPS.length - 1;
  const StepIcon = current.icon;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      {/* Overlay */}
      <div className="modal-backdrop" onClick={handleSkip} />

      {/* Modal */}
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Progress bar */}
        <div className="flex h-1 bg-surface-3">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`flex-1 transition-all duration-500 ease-out ${
                i <= step
                  ? "bg-accent"
                  : "bg-surface-3"
              }`}
            />
          ))}
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-4 flex items-center justify-between">
          <span className="text-eyebrow text-text-muted">
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="text-eyebrow text-text-muted">
            {Math.round(((step + 1) / STEPS.length) * 100)}%
          </span>
        </div>

        {/* Content */}
        <div className="modal-body space-y-6">
          {/* Icon + Title */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <StepIcon size={24} className="text-accent" />
            </div>
            <div>
              <h2 id="onboarding-title" className="text-2xl font-bold text-text-primary">
                {current.title}
              </h2>
              <p className="text-text-secondary text-sm mt-0.5">{current.subtitle}</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-text-secondary text-sm leading-relaxed">
            {current.content}
          </p>

          {/* Highlights list */}
          {current.highlights && (
            <ul className="space-y-2">
              {current.highlights.map((h, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                  {h}
                </li>
              ))}
            </ul>
          )}

          {/* Examples */}
          {current.examples && (
            <div className="bg-surface-0/50 rounded-lg p-4 space-y-2">
              {current.examples.map((ex, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="text-text-muted w-20 shrink-0">{ex.label}</span>
                  <code className="font-mono text-text-primary bg-surface-3/50 px-2 py-1 rounded flex-1 break-all">
                    {ex.value}
                  </code>
                </div>
              ))}
              {current.note && (
                <p className="text-[11px] text-text-muted mt-2 leading-relaxed inline-flex items-center gap-1.5">
                  <LightbulbIcon size={14} className="opacity-60 shrink-0" /> {current.note}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="modal-footer">
          <button
            onClick={handleSkip}
            className="btn-ghost btn-sm btn-magnetic"
          >
            Skip tutorial
          </button>
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="btn-secondary btn-sm btn-magnetic"
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="btn-primary btn-sm"
            >
              {isLast ? (
                <span className="flex items-center gap-1.5">
                  <SparklesIcon size={14} /> Get Started
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  Continue <ArrowRightIcon size={14} />
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
