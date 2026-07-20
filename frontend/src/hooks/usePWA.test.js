import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePWA } from "./usePWA";

describe("usePWA()", () => {
  it("returns default state", () => {
    const { result } = renderHook(() => usePWA());
    expect(result.current.isInstallable).toBe(false);
    expect(result.current.isStandalone).toBe(false);
    expect(typeof result.current.installApp).toBe("function");
  });
  it("installApp returns undefined when no prompt", async () => {
    const { result } = renderHook(() => usePWA());
    expect(await result.current.installApp()).toBeUndefined();
  });
});
