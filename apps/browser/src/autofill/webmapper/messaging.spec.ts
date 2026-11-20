import { WebmapperCommand } from "./messaging";

describe("WebmapperCommand", () => {
  it("defines the selector-capture command names", () => {
    expect(WebmapperCommand.GetSelector).toBe("webmapperGetSelector");
    expect(WebmapperCommand.GetContainerCandidates).toBe("webmapperGetContainerCandidates");
  });

  it("is frozen so command names can't be mutated at runtime", () => {
    expect(Object.isFrozen(WebmapperCommand)).toBe(true);
  });
});
