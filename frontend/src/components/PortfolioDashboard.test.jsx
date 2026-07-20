/**
 * PortfolioDashboard.test.jsx
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import PortfolioDashboard from "./PortfolioDashboard";

vi.mock("../api/client", () => ({ API_BASE: "" }));

beforeEach(() => { vi.restoreAllMocks(); });

function mockFetch(data) {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
  );
}

describe("PortfolioDashboard", () => {
  it("shows loading state initially", () => {
    mockFetch({ projects: [] });
    render(<PortfolioDashboard onSelectPath={() => {}} />);
    expect(screen.getByText("Loading portfolio...")).toBeTruthy();
  });

  it("shows empty state when no projects", async () => {
    mockFetch({ projects: [], total: 0 });
    render(<PortfolioDashboard onSelectPath={() => {}} />);
    const el = await screen.findByText("No projects scanned yet.");
    expect(el).toBeTruthy();
  });

  it("renders project list", async () => {
    mockFetch({
      projects: [{ path: "/repo/a", grade: "A", score: 95, total_files: 10, total_violations: 2, created_at: "2026-01-01" }],
      total: 1
    });
    render(<PortfolioDashboard onSelectPath={() => {}} />);
    const el = await screen.findByText("1 project tracked");
    expect(el).toBeTruthy();
  });

  it("calls onSelectPath when clicking a row", async () => {
    const onSelect = vi.fn();
    mockFetch({
      projects: [{ path: "/repo/a", grade: "B", score: 80, total_files: 5, total_violations: 10, created_at: "2026-01-01" }],
      total: 1
    });
    render(<PortfolioDashboard onSelectPath={onSelect} />);
    // Wait for data to load then click the row
    const gradeEl = await screen.findByText("B");
    const row = gradeEl.closest("tr") || gradeEl;
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalled();
  });
});
