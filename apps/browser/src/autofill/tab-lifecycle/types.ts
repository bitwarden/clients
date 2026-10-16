import type { TabEdgeCause, TabState } from "./enums";

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

/**
 * A state change the machine has classified. The machine only reports state transitions.
 *
 * Resting states are not guaranteed by the machine. See `lifecycle.design.md`, "States are virtual".
 */
export interface TabEdge {
  /** The state being left */
  from: TabState;
  /** The state being entered; this is not the same as a resting state. */
  to: TabState;
  /** separates changes that share endpoints. */
  cause: TabEdgeCause;
  /**
   * The window's focus as of this change. Authoritative for `Warm` and `Hot`, which are defined by
   * it; elsewhere it carries the last value the machine was told and should not be read as live.
   */
  focused: boolean;
}

/** A tab's position in the machine: its state, the window focus behind it, and how it got there. */
export interface MachineContext {
  state: TabState;
  focused: boolean;
  cause: TabEdgeCause;
}

/** What a page-transition buffer does with a transition: surface a fill, drop it, or keep waiting. */
export type BufferAction = "resolve" | "drop" | "keep";

/**
 * The browser-supplied facts a transition is stamped from. Every field originates with the browser
 * (`chrome.runtime.MessageSender`), never with the page. A reporting frame contributes the *fact of*
 * a transition and nothing else.
 */
export type TransitionReport = Readonly<{
  tabId: number | undefined;
  frameId: number | undefined;
  documentId: string | undefined;
}>;

/**
 * A reported transition admitted to the buffer — `lifecycle.design.md`'s *buffered* state, made
 * concrete. This is the persisted shape: it identifies a document without describing it, so a stored
 * buffer discloses no browsing activity. Do not add fields that describe the page (URL, title,
 * origin).
 */
export type BufferedTransitionReport = Readonly<{
  tabId: number;
  frameId: number | undefined;
  /** Browser-assigned UUID of the reporting document. Opaque; carries no page content. */
  documentId: string;
  /** Epoch ms the report was admitted. Orders reports for a frame. */
  stampedAt: number;
  /**
   * Absolute epoch-ms deadline, exclusive: the report is expired at `now >= expiresAt`. Absolute,
   * not relative, so it survives an MV3 restart.
   */
  expiresAt: number;
}>;

/**
 * The live facts of a frame that exists. A frame always has a `documentId` field; the browser may
 * decline to populate it, which is {@link TransitionValidity.Unverifiable}, not absence of a frame.
 * A frame that is *gone* is the absence of a `LiveFrame`, expressed at the parameter.
 */
export type LiveFrame = Readonly<{ documentId: string | undefined }>;

/** Buffered reports, keyed by {@link transitionKey}. */
export type BufferedTransitions = Record<string, BufferedTransitionReport>;
