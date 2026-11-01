import type { UserId } from "@bitwarden/common/types/guid";

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
 * A page transition as the page lifecycle reports it. None of it comes from the page: a reporting
 * frame contributes the *fact of* a transition and nothing else.
 */
export type TransitionReport = Readonly<{
  /** The account active when the transition was reported, from the background's account state. */
  userId: UserId | undefined;
  /** The reporting tab, from `chrome.runtime.MessageSender`. */
  tabId: number | undefined;
  /** The reporting frame, from `chrome.runtime.MessageSender`. `undefined` for the top frame. */
  frameId: number | undefined;
  /** The reporting document's UUID, from `chrome.runtime.MessageSender`. */
  documentId: string | undefined;
}>;
