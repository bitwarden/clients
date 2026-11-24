import { CompletionScopeKind } from "./enums";
import type { LifecycleFrame, CompletionScope } from "./types";

/** Whether a completion of `scope` reaches the lifecycle of `frame`. */
export function completes(scope: CompletionScope, frame: LifecycleFrame): boolean {
  switch (scope.kind) {
    case CompletionScopeKind.Frame:
      return scope.tabId === frame.tabId && scope.frameId === frame.frameId;

    case CompletionScopeKind.Tab:
      return scope.tabId === frame.tabId;

    case CompletionScopeKind.All:
      return true;
  }
}
