import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import GradeBadge, { SeverityBadge } from "./Badge";

describe("GradeBadge", () => {
  it("renders the grade letter", () => {
    render(<GradeBadge grade="A" />);
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("shows score in lg size", () => {
    render(<GradeBadge grade="B" score={85} size="lg" />);
    expect(screen.getByText("(85)")).toBeInTheDocument();
  });

  it("does not show score in sm size", () => {
    render(<GradeBadge grade="C" score={65} size="sm" />);
    expect(screen.queryByText("(65)")).not.toBeInTheDocument();
  });

  it("adds title attribute when score is provided", () => {
    render(<GradeBadge grade="A" score={95} />);
    expect(screen.getByText("A").closest("span")).toHaveAttribute("title", "Score: 95/100");
  });
});

describe("SeverityBadge", () => {
  it("renders severity text", () => {
    render(<SeverityBadge severity="high" />);
    expect(screen.getByText("high")).toBeInTheDocument();
  });

  it("renders medium severity", () => {
    render(<SeverityBadge severity="medium" />);
    expect(screen.getByText("medium")).toBeInTheDocument();
  });

  it("renders unknown severity with default style", () => {
    render(<SeverityBadge severity="unknown" />);
    expect(screen.getByText("unknown")).toBeInTheDocument();
  });
});
