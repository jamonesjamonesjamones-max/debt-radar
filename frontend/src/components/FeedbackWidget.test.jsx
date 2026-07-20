/**
 * FeedbackWidget.test.jsx
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FeedbackWidget from "./FeedbackWidget";

describe("FeedbackWidget", () => {
  beforeEach(() => { localStorage.clear(); });

  it("renders three feedback buttons", () => {
    render(<FeedbackWidget scanGrade="B" onDismiss={() => {}} />);
    expect(screen.getByText("Found new issues")).toBeTruthy();
    expect(screen.getByText("Already knew")).toBeTruthy();
    expect(screen.getByText("Not useful")).toBeTruthy();
  });

  it("stores answer in localStorage on click", () => {
    render(<FeedbackWidget scanGrade="C" onDismiss={() => {}} />);
    fireEvent.click(screen.getByText("Found new issues"));
    const stored = JSON.parse(localStorage.getItem("debtradar-feedback") || "[]");
    expect(stored.length).toBe(1);
    expect(stored[0].answer).toBe("found_new");
  });

  it("appends to existing feedback", () => {
    localStorage.setItem("debtradar-feedback", JSON.stringify([{ answer: "found_new", grade: "A" }]));
    render(<FeedbackWidget scanGrade="B" onDismiss={() => {}} />);
    fireEvent.click(screen.getByText("Already knew"));
    const stored = JSON.parse(localStorage.getItem("debtradar-feedback") || "[]");
    expect(stored.length).toBe(2);
  });

  it("hides after answering", () => {
    const { container } = render(<FeedbackWidget scanGrade="A" onDismiss={() => {}} />);
    fireEvent.click(screen.getByText("Found new issues"));
    expect(container.innerHTML).toBe("");
  });

  it("calls onDismiss when clicking dismiss", () => {
    const onDismiss = vi.fn();
    render(<FeedbackWidget scanGrade="B" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText("Dismiss"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
