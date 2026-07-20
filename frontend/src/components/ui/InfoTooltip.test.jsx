import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import InfoTooltip from "./InfoTooltip";

describe("InfoTooltip", () => {
  it("renders info button", () => {
    render(<InfoTooltip text="Help" />);
    expect(screen.getByRole("button", { name: /more information/i })).toBeInTheDocument();
  });
  it("shows tooltip on hover", () => {
    render(<InfoTooltip text="Tooltip text" />);
    fireEvent.mouseEnter(screen.getByRole("button"));
    expect(screen.getByText("Tooltip text")).toBeInTheDocument();
  });
  it("hides tooltip on mouse leave", () => {
    render(<InfoTooltip text="Temp" />);
    const btn = screen.getByRole("button");
    fireEvent.mouseEnter(btn);
    expect(screen.getByText("Temp")).toBeInTheDocument();
    fireEvent.mouseLeave(btn);
    expect(screen.queryByText("Temp")).not.toBeInTheDocument();
  });
});
