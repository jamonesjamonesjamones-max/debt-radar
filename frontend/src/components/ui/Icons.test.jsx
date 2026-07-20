import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import * as Icons from "./Icons";

describe("Icons", () => {
  // Test that all exported icon components render an SVG
  const iconNames = Object.keys(Icons).filter(
    name => typeof Icons[name] === "function" && !name.startsWith("_")
  );

  it.each(iconNames)("%s renders an SVG element", (name) => {
    const Icon = Icons[name];
    if (!Icon) return;
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it.each(iconNames)("%s has aria-hidden=true", (name) => {
    const Icon = Icons[name];
    if (!Icon) return;
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it.each(iconNames)("%s accepts size and className props", (name) => {
    const Icon = Icons[name];
    if (!Icon) return;
    const { container } = render(<Icon size={24} className="custom-icon" />);
    const svg = container.querySelector("svg");
    if (svg) {
      expect(svg.getAttribute("width")).toBe("24");
      expect(svg.getAttribute("class")).toContain("custom-icon");
    }
  });
});
