/**
 * Dashboard.integration.test.jsx — Tests that exercise Dashboard with multiple child components.
 * Lazy-loaded children are mocked to avoid loading actual implementations.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import Dashboard from "./Dashboard";

// Mock all lazy-loaded child components
vi.mock("./HeatMap", () => ({ default: (p) => <div data-testid="heatmap">{p.files?.length} files</div> }));
vi.mock("./RadarChart", () => ({ default: () => <div data-testid="radarchart" /> }));
vi.mock("./HallOfShame", () => ({ default: (p) => <div data-testid="hall-of-shame">{p.files?.length} files</div> }));
vi.mock("./CodeViewer", () => ({ default: (p) => <div data-testid="code-viewer">{p.file?.path}</div> }));
vi.mock("./ScanHistory", () => ({ default: () => <div data-testid="scan-history" /> }));
vi.mock("./ActionPlan", () => ({ default: () => <div data-testid="action-plan" /> }));
vi.mock("./ScanDiff", () => ({ default: () => <div data-testid="scan-diff" /> }));
vi.mock("./DependencyGraph", () => ({ default: () => <div data-testid="dep-graph" /> }));

const mockData = {
  summary: {
    grade: "B",
    average_score: 78,
    total_files: 25,
    total_lines: 4500,
    total_violations: 42,
    violations_by_type: { max_nesting: 10, magic_number: 20, todo: 12 },
    grade_distribution: { A: 5, B: 10, C: 5, D: 3, F: 2 },
    top_offenders: [{ path: "/bad/file.js", score: 25 }],
    scan_time_seconds: 3.5,
    workers_used: 4,
    scan_path: "/test/repo",
  },
  files: [
    { path: "/good/file.js", lines: 100, score: 95, language: "javascript", deductions: {}, violations: [] },
    { path: "/bad/file.js", lines: 500, score: 25, language: "javascript", deductions: { file_size: 20, complexity: 30 }, violations: [{ type: "max_nesting", line: 10, severity: "high", context: "deeply nested" }] },
  ],
  skipped_files: [{ path: "/secret/.env", reason: "Sensitive file" }],
};

describe("Dashboard integration", () => {
  beforeEach(() => {
    localStorage.clear();
    window.scrollTo = vi.fn();
  });

  it("renders SummaryBar and ExecutiveSummary with data", () => {
    render(<Dashboard data={mockData} jobId="test-123" />);
    expect(screen.getByText("Executive Summary")).toBeInTheDocument();
    expect(screen.getAllByText("25").length).toBeGreaterThanOrEqual(1); // total files appears in SummaryBar + ExecutiveSummary
  });

  it("shows HeatMap and RadarChart by default", () => {
    render(<Dashboard data={mockData} jobId="test-123" />);
    expect(screen.getByTestId("heatmap")).toBeInTheDocument();
    expect(screen.getByTestId("radarchart")).toBeInTheDocument();
  });

  it("shows HallOfShame and ActionPlan", () => {
    render(<Dashboard data={mockData} jobId="test-123" />);
    expect(screen.getByTestId("hall-of-shame")).toBeInTheDocument();
    expect(screen.getByTestId("action-plan")).toBeInTheDocument();
  });

  it("shows DependencyGraph when jobId exists", () => {
    render(<Dashboard data={mockData} jobId="test-123" />);
    expect(screen.getByTestId("dep-graph")).toBeInTheDocument();
  });

  it("toggle Focus Mode hides HeatMap and RadarChart", () => {
    render(<Dashboard data={mockData} jobId="test-123" />);
    expect(screen.getByTestId("heatmap")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Action Mode"));
    expect(screen.queryByTestId("heatmap")).not.toBeInTheDocument();
    expect(screen.queryByTestId("radarchart")).not.toBeInTheDocument();
  });

  it("Focus Mode still shows HallOfShame and ActionPlan", () => {
    render(<Dashboard data={mockData} jobId="test-123" />);
    fireEvent.click(screen.getByText("Action Mode"));
    expect(screen.getByTestId("hall-of-shame")).toBeInTheDocument();
    expect(screen.getByTestId("action-plan")).toBeInTheDocument();
  });

  it("shows skipped files section", () => {
    render(<Dashboard data={mockData} jobId="test-123" />);
    expect(screen.getByText(/Skipped files/)).toBeInTheDocument();
    expect(screen.getByText(/Sensitive file/)).toBeInTheDocument();
  });

  it("Focus Mode persists in localStorage", () => {
    render(<Dashboard data={mockData} jobId="test-123" />);
    fireEvent.click(screen.getByText("Action Mode"));
    expect(localStorage.getItem("debtradar-focus-mode")).toBe("true");
    fireEvent.click(screen.getByText("Full View"));
    expect(localStorage.getItem("debtradar-focus-mode")).toBe("false");
  });
});
