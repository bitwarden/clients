import { isOpenShellBinaryPath } from "../models/openshell-management";

import {
  describeOpenShellPrograms,
  findOpenShellProgram,
  OPENSHELL_PROGRAMS,
  pathsToSelection,
  programsToPaths,
} from "./openshell-program-catalog.util";

describe("openshell program catalog", () => {
  it("only holds valid, unique absolute paths and unique ids", () => {
    const paths = OPENSHELL_PROGRAMS.flatMap((program) => program.paths);
    expect(paths.every((path) => isOpenShellBinaryPath(path))).toBe(true);
    expect(new Set(paths).size).toBe(paths.length);
    expect(new Set(OPENSHELL_PROGRAMS.map((p) => p.id)).size).toBe(OPENSHELL_PROGRAMS.length);
  });

  it("includes the tools a user expects", () => {
    for (const id of ["curl", "wget", "git", "gh", "node", "npm", "python", "pip"]) {
      expect(findOpenShellProgram(id)).toBeDefined();
    }
    expect(findOpenShellProgram("claude")?.agent).toBe("claude");
    expect(findOpenShellProgram("codex")?.agent).toBe("codex");
  });

  describe("programsToPaths", () => {
    it("keeps every path of a selected program, in catalog order, then the custom ones", () => {
      expect(programsToPaths(["git", "curl"], ["/opt/tool"])).toEqual([
        "/usr/bin/curl",
        "/usr/local/bin/curl",
        "/usr/bin/git",
        "/usr/local/bin/git",
        "/opt/tool",
      ]);
    });

    it("drops duplicates and ignores unknown ids", () => {
      expect(programsToPaths(["nope", "curl"], ["/usr/bin/curl"])).toEqual([
        "/usr/bin/curl",
        "/usr/local/bin/curl",
      ]);
    });

    it("is empty for nothing selected", () => {
      expect(programsToPaths([], [])).toEqual([]);
    });
  });

  describe("pathsToSelection", () => {
    it("selects a program when any one of its paths is present", () => {
      expect(pathsToSelection(["/usr/bin/curl"])).toEqual({ ids: ["curl"], custom: [] });
      expect(pathsToSelection(["/usr/local/bin/gh"]).ids).toEqual(["gh"]);
    });

    it("keeps unknown paths as custom, once", () => {
      expect(pathsToSelection(["/usr/bin/git", "/opt/a", "/opt/a"])).toEqual({
        ids: ["git"],
        custom: ["/opt/a"],
      });
    });

    it("round-trips through programsToPaths", () => {
      const { ids, custom } = pathsToSelection(programsToPaths(["node", "pip"], ["/opt/x"]));
      expect(ids).toEqual(["node", "pip"]);
      expect(custom).toEqual(["/opt/x"]);
    });
  });

  describe("describeOpenShellPrograms", () => {
    it("names catalog programs and shows custom paths as they are", () => {
      const shown = describeOpenShellPrograms(["/usr/bin/curl", "/opt/tool"]);
      expect(shown.map((s) => s.program?.name ?? s.path)).toEqual(["curl", "/opt/tool"]);
    });

    it("is empty for no programs", () => {
      expect(describeOpenShellPrograms([])).toEqual([]);
    });
  });
});
