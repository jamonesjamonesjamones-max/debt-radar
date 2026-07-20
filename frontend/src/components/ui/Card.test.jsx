import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import Card, { SkeletonBlock, SkeletonCard } from "./Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card><p>Hello</p></Card>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("applies default variant class", () => {
    const { container } = render(<Card>Test</Card>);
    const div = container.firstChild;
    expect(div.className).toContain("shadow-card");
  });

  it("applies elevated variant", () => {
    const { container } = render(<Card variant="elevated">Test</Card>);
    const div = container.firstChild;
    expect(div.className).toContain("shadow-modal");
  });

  it("adds role=button and handles click when onClick provided", () => {
    const onClick = vi.fn();
    render(<Card onClick={onClick}>Click me</Card>);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies custom className", () => {
    const { container } = render(<Card className="extra-class">Test</Card>);
    const div = container.firstChild;
    expect(div.className).toContain("extra-class");
  });
});

describe("SkeletonBlock", () => {
  it("renders one block by default", () => {
    const { container } = render(<SkeletonBlock />);
    expect(container.querySelectorAll(".shimmer-block").length).toBe(1);
  });

  it("renders multiple blocks with count prop", () => {
    const { container } = render(<SkeletonBlock count={3} />);
    expect(container.querySelectorAll(".shimmer-block").length).toBe(3);
  });
});

describe("SkeletonCard", () => {
  it("renders skeleton blocks plus children", () => {
    render(<SkeletonCard lines={2}><p>Extra</p></SkeletonCard>);
    expect(screen.getByText("Extra")).toBeInTheDocument();
    expect(screen.getAllByText("").length).toBeGreaterThan(0);
  });
});
