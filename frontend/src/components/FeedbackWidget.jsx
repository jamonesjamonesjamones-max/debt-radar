/**
 * FeedbackWidget — Anonymous feedback after scan completion.
 * Data stays in localStorage.
 */

import { useState } from "react";
import { LightbulbIcon, CheckIcon, CloseIcon } from "./ui/Icons";

const STORAGE_KEY = "debtradar-feedback";

export default function FeedbackWidget({ scanGrade, onDismiss }) {
  const [answered, setAnswered] = useState(false);

  const handleAnswer = (answer) => {
    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      existing.push({ answer, grade: scanGrade, date: new Date().toISOString() });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
    } catch {}
    setAnswered(true);
  };

  if (answered) return null;

  return (
    <div className="card-premium p-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <LightbulbIcon size={20} className="text-semantic-warning mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-text-primary">How was this scan?</p>
          <p className="text-xs text-text-muted mt-0.5">Help improve DebtRadar — one quick click</p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <button onClick={() => handleAnswer("found_new")}
              className="btn-secondary btn-sm btn-magnetic">
              <LightbulbIcon size={12} /> Found new issues
            </button>
            <button onClick={() => handleAnswer("already_knew")}
              className="btn-secondary btn-sm btn-magnetic">
              <CheckIcon size={12} /> Already knew
            </button>
            <button onClick={() => handleAnswer("not_useful")}
              className="btn-ghost btn-sm btn-magnetic text-text-muted">
              Not useful
            </button>
          </div>
        </div>
        <button onClick={onDismiss} className="btn-ghost btn-sm !px-1.5 shrink-0" aria-label="Dismiss">
          <CloseIcon size={12} />
        </button>
      </div>
    </div>
  );
}
