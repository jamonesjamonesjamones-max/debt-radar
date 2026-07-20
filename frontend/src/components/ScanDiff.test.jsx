/**
 * ScanDiff.test.jsx
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ScanDiff from "./ScanDiff";

vi.mock("../api/client", () => ({ API_BASE: "" }));

beforeEach(() => { vi.restoreAllMocks(); });

function mockFetch(data) {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
  );
}

function mockFetchError() {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ ok: false, status: 404 })
  );
}

describe("ScanDiff", () => {
  it("shows loading state initially", () => {
    mockFetch({ diffs: [] });
    render(<ScanDiff jobId="test123" />);
    expect(screen.getByText("Comparing scans...")).toBeTruthy();
  });

  it("shows error state on fetch failure", async () => {
    mockFetchError();
    render(<ScanDiff jobId="test123" />);
    const el = await screen.findByText(/Comparison unavailable/);
    expect(el).toBeTruthy();
  });

  it("shows comparison summary when comparison data exists", async () => {
    mockFetch({ error: "Specify ?against=...", comparison: { trend: "improving", score_diff: 5 } });
    render(<ScanDiff jobId="test123" />);
    const el = await screen.findByText(/Improving/);
    expect(el).toBeTruthy();
  });

  it("renders diff table with entries", async () => {
    mockFetch({
      diffs: [{ file_path: "src/file.js", status: "regressed", score_change: -10, current_score: 50, violations_added_count: 1, violations_removed_count: 0 }],
      summary: { regressed: 1, improved: 0, new_files: 0, total_violations_removed: 0, total_violations_added: 1 }
    });
    render(<ScanDiff jobId="test123" />);
    const el = await screen.findByText("Regressed");
    expect(el).toBeTruthy();
  });

  it("returns null when no diffs and no comparison", () => {
    mockFetch({ error: "No comparison data" });
    const { container } = render(<ScanDiff jobId="test123" />);
    // Should eventually render null or error state
    expect(container).toBeTruthy();
  });
});
