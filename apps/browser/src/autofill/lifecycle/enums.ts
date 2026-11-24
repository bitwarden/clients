/**
 * The states of the tab-lifecycle machine — the explicit form of the monitoring/fill lifecycle each
 * tab runs through. See `lifecycle/design.md`, "The tab lifecycle".
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
 * The reason a `TabEdge` happened, named for the transition it represents. The machine takes
 * `TabEvent`s as input and reports `TabEdge`s as output. A cause says which input produced the edge.
 * Seven causes have the value of the `TabEvent` of the same name (`./tab/enums.ts`). `Settle` and
 * `CoolDownElapsed` are the machine's own timers expiring.
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

/** What an {@link AccountEvent} reports. */
export const AccountEventKind = Object.freeze({
  /**
   * The account signed in, whether locked or unlocked. Each account already signed in at the first
   * observation is reported immediately.
   */
  Login: "login",
  /** A signed-in account changed from locked to unlocked. */
  Unlock: "unlock",
  /** A signed-in account changed from unlocked to locked. */
  Lock: "lock",
  /** The account signed out. */
  Logout: "logout",
  /**
   * The active account changed to `to`, which is signed in. `from` is the account the last switch
   * went to, or `null` before the first. A switch to a signed-out account comes right after its
   * login. The active account becoming none emits nothing, so its return to the same account emits
   * nothing either.
   */
  Switch: "switch",
  /** The first observation has been reported: every event before it describes the accounts then. */
  Bootstrapped: "bootstrapped",
} as const);
export type AccountEventKind = (typeof AccountEventKind)[keyof typeof AccountEventKind];
