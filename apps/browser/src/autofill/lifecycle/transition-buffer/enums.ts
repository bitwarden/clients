/**
 * Whether a buffered report may be acted on, and if not, why.
 *
 * `Unverifiable` is not a verdict: the caller decides the policy. For unprompted fills, treat it as
 * invalid.
 */
export const TransitionValidity = Object.freeze({
  Valid: "valid",
  Expired: "expired",
  FrameGone: "frame-gone",
  DocumentChanged: "document-changed",
  Unverifiable: "unverifiable",
} as const);
export type TransitionValidity = (typeof TransitionValidity)[keyof typeof TransitionValidity];

/**
 * What the controller does with a transition: buffer it until its tab is hot, resolve it into an
 * opportunity, or drop it. See `model.md`, "Terminology".
 */
export const BufferAction = Object.freeze({
  /** Hold the transition until its tab is hot. */
  Buffer: "buffer",
  /** Release the transition as an opportunity. */
  Resolve: "resolve",
  /** End the transition without it becoming an opportunity. */
  Drop: "drop",
} as const);
export type BufferAction = (typeof BufferAction)[keyof typeof BufferAction];

/** What happened to the transition buffer's environment, as the controller applies it. */
export const PageTransitionEventKind = Object.freeze({
  /** A frame reported a transition. */
  Report: "report",
  /** The accounts changed. */
  Account: "account",
  /** The age bound of a transition became known, or changed. */
  MaxAge: "maxAge",
  /** A tab changed state. */
  TabChanged: "tabChanged",
  /** A tab was removed. */
  TabRemoved: "tabRemoved",
  /** A frame no longer exists. */
  FrameLost: "frameLost",
  /** The autofill scripts are about to be injected into every frame anew. */
  ScriptsReloading: "scriptsReloading",
  /** The buffer restored a transition from storage. */
  Restored: "restored",
} as const);
export type PageTransitionEventKind =
  (typeof PageTransitionEventKind)[keyof typeof PageTransitionEventKind];
