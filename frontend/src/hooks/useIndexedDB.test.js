/**
 * useIndexedDB.test.js
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

// We test the exported API surface and graceful degradation
describe("useIndexedDB module", () => {
  it("exports expected functions", async () => {
    const mod = await import("./useIndexedDB");
    expect(typeof mod.cacheScanResult).toBe("function");
    expect(typeof mod.getCachedScanResult).toBe("function");
    expect(typeof mod.getAllCachedResults).toBe("function");
    expect(typeof mod.clearCache).toBe("function");
  });

  it("cacheScanResult does not throw when IndexedDB is mocked", async () => {
    const mod = await import("./useIndexedDB");
    // In test environment, indexedDB may not be available
    // The function should handle this gracefully
    const result = await mod.cacheScanResult("test-job", { score: 85 });
    expect(result).toBeUndefined();
  });

  it("getCachedScanResult returns null when no data", async () => {
    const mod = await import("./useIndexedDB");
    const result = await mod.getCachedScanResult("nonexistent-job");
    expect(result).toBeNull();
  });

  it("getAllCachedResults returns empty array when no data", async () => {
    const mod = await import("./useIndexedDB");
    const result = await mod.getAllCachedResults();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("clearCache does not throw", async () => {
    const mod = await import("./useIndexedDB");
    await expect(mod.clearCache()).resolves.not.toThrow();
  });
});
