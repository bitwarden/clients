import { tabFromSegment } from "./detail-tab";

describe("tabFromSegment", () => {
  const tabs = ["configuration", "history"] as const;

  it("returns the tab the segment names", () => {
    expect(tabFromSegment("history", tabs)).toBe("history");
    expect(tabFromSegment("configuration", tabs)).toBe("configuration");
  });

  it.each([
    ["a segment naming no tab", "does-not-exist"],
    ["a missing param", null],
    ["no param at all", undefined],
    ["an empty segment", ""],
  ])("falls back to the first tab for %s", (_name, segment) => {
    expect(tabFromSegment(segment, tabs)).toBe("configuration");
  });

  it("draws its answer from the caller's own list, not a shared one", () => {
    expect(tabFromSegment("history", ["overview", "activity"] as const)).toBe("overview");
  });
});
