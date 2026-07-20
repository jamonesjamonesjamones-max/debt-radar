import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="No data" description="Nothing here." />);
    expect(screen.getByText("No data")).toBeInTheDocument();
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });
  it("renders hint", () => {
    render(<EmptyState title="Test" hint="Try again" />);
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });
  it("renders technical details", () => {
    render(<EmptyState title="Err" technical="Stack trace" />);
    expect(screen.getByText("Technical details")).toBeInTheDocument();
  });
});
