/**
 * The states of the tab-lifecycle machine — the explicit form of the monitoring/fill lifecycle each
 * tab runs through. See `lifecycle.design.md`, "The tab lifecycle".
 */
export const TabState = Object.freeze({
  Frozen: "frozen",
  Cold: "cold",
  WarmUp: "warm-up",
  Warm: "warm",
  Hot: "hot",
  CoolDown: "cool-down",
} as const);

export type TabState = (typeof TabState)[keyof typeof TabState];

/**
 * The event that drove a `TabEdge`, named for the transition it represents. `Settle` and
 * `CoolDownElapsed` are synthesized internally when a timer fires; the other seven correspond to
 * `TabLifecycleEvent` kinds (both in `./types.ts`).
 */
export const TabEdgeCause = Object.freeze({
  Login: "login",
  Logout: "logout",
  Activate: "activate",
  Deactivate: "deactivate",
  Focus: "focus",
  Blur: "blur",
  Settle: "settle",
  CoolDownElapsed: "cool-down-elapsed",
  Command: "command",
} as const);

export type TabEdgeCause = (typeof TabEdgeCause)[keyof typeof TabEdgeCause];

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
