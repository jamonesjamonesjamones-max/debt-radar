import { describe, it, expect } from "vitest";
import { shortenPath, fileName } from "./paths";

describe("shortenPath()", () => {
  it("returns original path when fewer parts than keep", () => {
    expect(shortenPath("file.py", 2)).toBe("file.py");
    expect(shortenPath("folder/file.py", 2)).toBe("folder/file.py");
  });

  it("shortens long Unix paths", () => {
    const result = shortenPath("/home/user/projects/my-app/src/index.js", 2);
    expect(result).toContain("index.js");
    expect(result.length).toBeLessThan("/home/user/projects/my-app/src/index.js".length);
  });

  it("shortens long Windows paths", () => {
    const result = shortenPath("C:/Users/you/project/src/app.js", 2);
    expect(result).toContain("app.js");
    expect(result.length).toBeLessThan(50);
  });

  it("handles null gracefully", () => {
    expect(shortenPath(null)).toBe("");
  });
});

describe("fileName()", () => {
  it("extracts filename from Unix path", () => {
    expect(fileName("/home/user/file.js")).toBe("file.js");
  });
  it("extracts filename from Windows path", () => {
    expect(fileName("C:/Users/you/file.js")).toBe("file.js");
  });
  it("handles empty string", () => {
    expect(fileName("")).toBe("");
  });
});
