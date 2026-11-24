/** What part of a tab a scope covers. */
export const LeaseScopeKind = Object.freeze({
  /** The whole tab: every frame of it. */
  Tab: "tab",
  /** One frame of the tab. */
  Frame: "frame",
} as const);
export type LeaseScopeKind = (typeof LeaseScopeKind)[keyof typeof LeaseScopeKind];

/** The part of a tab a request touches. See `model.md`, "Scope". */
export type LeaseScope =
  | Readonly<{ kind: typeof LeaseScopeKind.Tab; tabId: number }>
  | Readonly<{ kind: typeof LeaseScopeKind.Frame; tabId: number; frameId: number }>;

/** The scope of every frame of a tab. */
export function tabScope(tabId: number): LeaseScope {
  return Object.freeze({ kind: LeaseScopeKind.Tab, tabId });
}

/** The scope of one frame of a tab. The top frame is frame `0`. */
export function frameScope(tabId: number, frameId: number): LeaseScope {
  return Object.freeze({ kind: LeaseScopeKind.Frame, tabId, frameId });
}

/** Whether two scopes touch any part of a tab in common. A tab overlaps each of its frames. */
export function scopesOverlap(a: LeaseScope, b: LeaseScope): boolean {
  if (a.tabId !== b.tabId) {
    return false;
  }
  if (a.kind === LeaseScopeKind.Tab || b.kind === LeaseScopeKind.Tab) {
    return true;
  }
  return a.frameId === b.frameId;
}
