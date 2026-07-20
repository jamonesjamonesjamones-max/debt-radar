/**
 * ConfettiOverlay — Small celebration animation that fires when scan completes.
 * Uses CSS animations (no canvas) to keep bundle size small.
 */
import { useEffect, useState } from "react";

const COLORS = ["#6366f1", "#818cf8", "#22c55e", "#84cc16", "#f59e0b", "#f97316", "#ef4444", "#a78bfa"];
const CONFETTI_COUNT = 40;

function createParticle(i) {
  return {
    id: i,
    color: COLORS[i % COLORS.length],
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 2,
    size: 4 + Math.random() * 6,
    rotation: Math.random() * 360,
  };
}

export default function ConfettiOverlay({ show, onDone }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!show) {
      setParticles([]);
      return;
    }
    const p = Array.from({ length: CONFETTI_COUNT }, (_, i) => createParticle(i));
    setParticles(p);
    const timer = setTimeout(() => {
      setParticles([]);
      if (onDone) onDone();
    }, 4000);
    return () => clearTimeout(timer);
  }, [show, onDone]);

  if (!particles.length) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-fall"
          style={{
            left: `${p.left}%`,
            top: "-10px",
            width: `${p.size}px`,
            height: `${p.size * 0.6}px`,
            backgroundColor: p.color,
            borderRadius: "1px",
            opacity: 0.9,
            transform: `rotate(${p.rotation}deg)`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}

    </div>
  );
}
