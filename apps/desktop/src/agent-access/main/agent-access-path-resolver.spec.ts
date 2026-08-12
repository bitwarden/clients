import * as path from "path";

import { findMatchingPathSpec, resolvePathSpec } from "./agent-access-path-resolver";

describe("resolvePathSpec", () => {
  const originalPlatform = process.platform;
  const roots = { homedir: "/Users/test", appDataPath: "/Users/test/Library/Application Support" };

  const setPlatform = (platform: NodeJS.Platform) => {
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
  };

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("resolves a home-based spec against the injected homedir", () => {
    const result = resolvePathSpec({ base: "home", segments: [".claude.json"] }, roots);

    expect(result).toBe(path.join(roots.homedir, ".claude.json"));
  });

  it("resolves an appData-based spec against the injected appDataPath, not the homedir", () => {
    const result = resolvePathSpec(
      { base: "appData", segments: ["Code", "User", "mcp.json"] },
      roots,
    );

    expect(result).toBe(path.join(roots.appDataPath, "Code", "User", "mcp.json"));
  });

  it("returns null when the spec is restricted to a platform the process isn't running on", () => {
    setPlatform("darwin");

    const result = resolvePathSpec(
      { base: "appData", segments: ["Code", "User", "mcp.json"], platforms: ["win32"] },
      roots,
    );

    expect(result).toBeNull();
  });

  it("resolves when the spec's platform restriction matches the current process", () => {
    setPlatform("win32");

    const result = resolvePathSpec(
      { base: "appData", segments: ["Code", "User", "mcp.json"], platforms: ["win32"] },
      roots,
    );

    expect(result).toBe(path.join(roots.appDataPath, "Code", "User", "mcp.json"));
  });

  it("resolves when no platform restriction is present, regardless of current platform", () => {
    setPlatform("linux");

    const result = resolvePathSpec({ base: "home", segments: [".cursor", "mcp.json"] }, roots);

    expect(result).toBe(path.join(roots.homedir, ".cursor", "mcp.json"));
  });
});

describe("findMatchingPathSpec", () => {
  const originalPlatform = process.platform;

  const setPlatform = (platform: NodeJS.Platform) => {
    Object.defineProperty(process, "platform", { value: platform, configurable: true });
  };

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  it("picks the candidate matching the current platform", () => {
    setPlatform("win32");
    const candidates = [
      { base: "appData" as const, segments: ["mac"], platforms: ["darwin" as const] },
      { base: "appData" as const, segments: ["win"], platforms: ["win32" as const] },
    ];

    const result = findMatchingPathSpec(candidates);

    expect(result).toBe(candidates[1]);
  });

  it("picks a candidate with no platform restriction as a catch-all", () => {
    setPlatform("linux");
    const candidates = [{ base: "home" as const, segments: ["everywhere"] }];

    const result = findMatchingPathSpec(candidates);

    expect(result).toBe(candidates[0]);
  });

  it("returns null when nothing matches the current platform", () => {
    setPlatform("linux");
    const candidates = [
      { base: "appData" as const, segments: ["mac"], platforms: ["darwin" as const] },
      { base: "appData" as const, segments: ["win"], platforms: ["win32" as const] },
    ];

    const result = findMatchingPathSpec(candidates);

    expect(result).toBeNull();
  });

  it("returns null for an empty candidate list", () => {
    expect(findMatchingPathSpec([])).toBeNull();
  });
});
