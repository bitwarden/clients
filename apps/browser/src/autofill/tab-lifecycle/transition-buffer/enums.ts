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
