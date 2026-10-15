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
