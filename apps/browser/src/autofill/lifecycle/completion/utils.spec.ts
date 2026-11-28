import { CompletionScopeKind } from "./enums";
import type { LifecycleFrame, CompletionScope } from "./types";
import { completes } from "./utils";

const frame = (tabId: number, frameId: number | undefined): LifecycleFrame => ({
  tabId,
  frameId,
});
const frameScope = (tabId: number, frameId: number | undefined): CompletionScope => ({
  kind: CompletionScopeKind.Frame,
  tabId,
  frameId,
});
const tabScope = (tabId: number): CompletionScope => ({ kind: CompletionScopeKind.Tab, tabId });
const allScope: CompletionScope = { kind: CompletionScopeKind.All };

describe("completes", () => {
  it.each<[string, CompletionScope, LifecycleFrame, boolean]>([
    ["a frame's own scope", frameScope(7, 3), frame(7, 3), true],
    ["another frame of the tab", frameScope(7, 0), frame(7, 3), false],
    ["the same frame id in another tab", frameScope(8, 3), frame(7, 3), false],
    ["a frame without an id, by a scope with an id", frameScope(7, 0), frame(7, undefined), false],
    [
      "a frame with an id of zero, by a scope without one",
      frameScope(7, undefined),
      frame(7, 0),
      false,
    ],
    [
      "a frame without an id, by a scope without one",
      frameScope(7, undefined),
      frame(7, undefined),
      true,
    ],
    ["its tab, for any frame of it", tabScope(7), frame(7, 3), true],
    ["its tab, for the frame without an id", tabScope(7), frame(7, undefined), true],
    ["another tab", tabScope(8), frame(7, 3), false],
    ["every fill", allScope, frame(7, 3), true],
  ])("%s", (_, scope, target, expected) => {
    expect(completes(scope, target)).toBe(expected);
  });
});
