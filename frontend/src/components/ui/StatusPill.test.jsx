import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import StatusPill from "./StatusPill";

describe("StatusPill", () => {
  it("renders nesting with count", () => {
    render(<StatusPill type="max_nesting" count={5} />);
    expect(screen.getByText("Nesting")).toBeInTheDocument();
  });
  it("renders magic_number", () => {
    render(<StatusPill type="magic_number" count={3} />);
    expect(screen.getByText("Magic #")).toBeInTheDocument();
  });
  it("renders todo", () => {
    render(<StatusPill type="todo" count={1} />);
    expect(screen.getByText("TODO")).toBeInTheDocument();
  });
  it("handles unknown type", () => {
    render(<StatusPill type="custom" count={2} />);
    expect(screen.getByText("custom")).toBeInTheDocument();
  });
});
