import type { Observable } from "rxjs";

import type { TabEdgeCause, TabState } from "../enums";

/**
 * An external input to the machine. `activate` carries the window's focus at the moment of
 * activation; `focus` and `blur` update it thereafter.
 */
export type TabLifecycleEvent =
  | { kind: "login" }
  | { kind: "logout" }
  | { kind: "activate"; focused: boolean }
  | { kind: "deactivate" }
  | { kind: "focus" }
  | { kind: "blur" }
  | { kind: "command" };

/** A tab's position in the machine: its state, the window focus behind it, and how it got there. */
export interface MachineContext {
  state: TabState;
  focused: boolean;
  cause: TabEdgeCause;
}

/** The window and its tabs, as the browser reports them. `chrome.windows.Window` satisfies it. */
export type ObservedWindow = Readonly<{
  id?: number;
  focused: boolean;
  /** Present when the browser is asked to populate the window; a window without them has no active tab. */
  tabs?: ReadonlyArray<Readonly<{ id?: number; active: boolean }>>;
}>;

/** What {@link feedTabSignalReducer} reads. Every stream is subscribed once. */
export type ReducerSources = Readonly<{
  /** Whether anyone is signed in. See {@link signedIn}. */
  signedIn$: Observable<boolean>;
  tabActivated$: Observable<Readonly<{ tabId: number; windowId: number }>>;
  tabCreated$: Observable<Readonly<{ id?: number; windowId: number; active: boolean }>>;
  tabRemoved$: Observable<Readonly<{ tabId: number }>>;
  tabReplaced$: Observable<Readonly<{ removedTabId: number }>>;
  tabAttached$: Observable<Readonly<{ tabId: number }>>;
  tabDetached$: Observable<Readonly<{ tabId: number; oldWindowId: number }>>;
  /** The newly focused window's id, or `-1` for none. */
  windowFocusChanged$: Observable<number>;
  windowRemoved$: Observable<number>;
  /** Every window with its tabs: the browser's answer to what the signals above leave unclear. */
  getWindows: () => Promise<readonly ObservedWindow[]>;
  /** Called when `getWindows` fails. The reconciliation yields no events and the facts stand. */
  onReconcileError: (error: unknown) => void;
}>;

/** What the reducer delivers, in the order it is meant to be applied. */
export type TabSignal =
  /** An event for one tab. `signedIn` is the extension's state when it was derived. */
  | Readonly<{ kind: "tab"; tabId: number; event: TabLifecycleEvent; signedIn: boolean }>
  | Readonly<{
      kind: "all";
      event: Extract<TabLifecycleEvent, { kind: "login" | "logout" }>;
      signedIn: boolean;
    }>
  /** The tab does not exist. Nothing follows for it. */
  | Readonly<{ kind: "removed"; tabId: number }>
  /** The first reconciliation with the browser is complete, however it ended. */
  | Readonly<{ kind: "seeded" }>;
