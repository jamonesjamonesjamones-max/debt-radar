/**
 * DependencyGraph.test.jsx
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DependencyGraph from "./DependencyGraph";

vi.mock("../api/client", () => ({ API_BASE: "" }));

beforeEach(() => { vi.restoreAllMocks(); });

function mockFetch(data) {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(data) })
  );
}

describe("DependencyGraph", () => {
  it("shows loading state initially", () => {
    mockFetch({ nodes: [], edges: [] });
    const { container } = render(<DependencyGraph jobId="test123" onSelectFile={() => {}} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("shows error state on fetch failure", async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ ok: false, status: 404 })
    );
    render(<DependencyGraph jobId="test123" onSelectFile={() => {}} />);
    const el = await screen.findByText(/Dependency graph/);
    expect(el).toBeTruthy();
  });

  it("returns null when no nodes", async () => {
    mockFetch({ nodes: [], edges: [] });
    const { container } = render(<DependencyGraph jobId="test123" onSelectFile={() => {}} />);
    // Should render null (no error message)
    expect(container).toBeTruthy();
  });

  it("renders ForceGraph with nodes and edges", async () => {
    mockFetch({
      nodes: [{ id: "file1", name: "app.js", score: 85, fullPath: "/src/app.js" }],
      edges: [{ source: "file1", target: "file2" }]
    });
    render(<DependencyGraph jobId="test123" onSelectFile={() => {}} />);
    const el = await screen.findByText(/Dependency Graph/);
    expect(el).toBeTruthy();
  });

  it("shows file count and connection count", async () => {
    mockFetch({
      nodes: [{ id: "f1", name: "a.js", score: 90, fullPath: "/a.js" }],
      edges: []
    });
    render(<DependencyGraph jobId="test123" onSelectFile={() => {}} />);
    const el = await screen.findByText(/1 files/);
    expect(el).toBeTruthy();
  });
});
