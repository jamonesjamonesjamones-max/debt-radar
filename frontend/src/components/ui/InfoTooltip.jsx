/**
 * InfoTooltip - Small info button that shows contextual explanation on hover/focus.
 */

import { useState, useRef, useEffect, memo } from "react";
import { InfoIcon } from "./Icons";

const InfoTooltip = memo(function InfoTooltip({ text, side = "top" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const sideClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-surface-3 hover:bg-surface-4 text-text-muted hover:text-text-secondary interactive-transition"
        aria-label="More information"
      >
        <InfoIcon size={10} />
      </button>
      {open && (
        <div
          className={"absolute z-50 " + sideClasses[side] + " w-56 p-3 bg-surface-1 border border-surface-3 rounded-card shadow-dropdown text-xs text-text-secondary leading-relaxed animate-fade-in"}
          role="tooltip"
        >
          {text}
        </div>
      )}
    </span>
  );
});

export default InfoTooltip;
