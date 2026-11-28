import {
  frameScope,
  LeaseScopeKind,
  scopesOverlap,
  tabScope,
  type LeaseScope,
} from "./lease-scope";

describe("tabScope and frameScope", () => {
  it("name the whole tab, or one frame of it, explicitly", () => {
    expect(tabScope(1)).toEqual({ kind: LeaseScopeKind.Tab, tabId: 1 });
    expect(frameScope(1, 0)).toEqual({ kind: LeaseScopeKind.Frame, tabId: 1, frameId: 0 });
  });
});

describe("scopesOverlap", () => {
  it.each<[string, boolean, LeaseScope, LeaseScope]>([
    ["a tab and itself", true, tabScope(1), tabScope(1)],
    ["a tab and its top frame", true, tabScope(1), frameScope(1, 0)],
    ["a tab and another of its frames", true, tabScope(1), frameScope(1, 3)],
    ["a frame and itself", true, frameScope(1, 3), frameScope(1, 3)],
    ["two frames of one tab", false, frameScope(1, 0), frameScope(1, 3)],
    ["two tabs", false, tabScope(1), tabScope(2)],
    ["a tab and another tab's frame", false, tabScope(1), frameScope(2, 0)],
    ["the same frame id in two tabs", false, frameScope(1, 3), frameScope(2, 3)],
  ])("decides whether %s overlap: %p", (_, expected, a, b) => {
    expect(scopesOverlap(a, b)).toBe(expected);
    expect(scopesOverlap(b, a)).toBe(expected);
  });
});
