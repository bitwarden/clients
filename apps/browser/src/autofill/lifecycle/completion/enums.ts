/** Which lifecycles a completion reaches. See `model.md`. */
export const CompletionScopeKind = Object.freeze({
  /** The lifecycle of one frame. */
  Frame: "frame",

  /** The lifecycle of one tab, and of every frame in it. */
  Tab: "tab",

  /** Every lifecycle. */
  All: "all",
} as const);
export type CompletionScopeKind = (typeof CompletionScopeKind)[keyof typeof CompletionScopeKind];
