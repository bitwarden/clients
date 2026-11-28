/**
 * The inputs of a tab's lifecycle machine, as `lifecycle/design.md` defines them in "Event
 * transitions". Each is the `kind` of a {@link TabLifecycleEvent}.
 *
 * The machine's output is `TabEdge`s, and each edge records its `TabEdgeCause`. The cause of an edge
 * that an event produced has the value of that event.
 */
export const TabEvent = Object.freeze({
  /** At least one account is signed in. Delivered to every tab. */
  Login: "login",
  /** No account is signed in. Delivered to every tab. */
  Logout: "logout",
  /** The tab became its window's active tab. */
  Activate: "activate",
  /** The tab stopped being its window's active tab. */
  Deactivate: "deactivate",
  /** The tab's window became the focused window. */
  Focus: "focus",
  /** The tab's window stopped being the focused window. */
  Blur: "blur",
  /** A user-initiated fill targets the tab. */
  Command: "command",
} as const);

export type TabEvent = (typeof TabEvent)[keyof typeof TabEvent];

/** What a {@link TabSignal} asks of the tab lifecycles. */
export const TabSignalKind = Object.freeze({
  /** An event for one tab. */
  Tab: "tab",
  /** An event for every tab. */
  All: "all",
  /** The tab does not exist. */
  Removed: "removed",
} as const);
export type TabSignalKind = (typeof TabSignalKind)[keyof typeof TabSignalKind];
