import { describe, it, expect, vi, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import React from "react";
import ConfettiOverlay from "./ConfettiOverlay";

describe("ConfettiOverlay", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when show is false", () => {
    const { container } = render(<ConfettiOverlay show={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders particles when show is true", () => {
    const { container } = render(<ConfettiOverlay show={true} />);
    const particles = container.querySelectorAll(".animate-confetti-fall");
    expect(particles.length).toBeGreaterThan(0);
  });

  it("calls onDone after 4 seconds", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<ConfettiOverlay show={true} onDone={onDone} />);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("cleans up particles after 4 seconds", () => {
    vi.useFakeTimers();
    const { container } = render(<ConfettiOverlay show={true} />);
    expect(container.querySelectorAll(".animate-confetti-fall").length).toBeGreaterThan(0);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(container.innerHTML).toBe("");
  });
});
