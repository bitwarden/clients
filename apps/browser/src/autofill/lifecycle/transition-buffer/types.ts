import type { Observable } from "rxjs";

import type { UserId } from "@bitwarden/common/types/guid";

import type { TabEdge } from "../types";

/**
 * A reported transition, stamped by `registerTransition` and reconciled by a `TransitionBuffer`.
 * This is the persisted shape: it identifies a document without describing it, so a stored buffer
 * discloses no browsing activity. Do not add fields that describe the page (URL, title, origin).
 *
 * WARNING: These reports are shared across accounts. You must verify the active account
 * against a stored record's `userId` to avoid cross-account replays.
 */
export type BufferedTransitionReport = Readonly<{
  /**
   * The account active when the transition was reported.
   */
  userId: UserId;
  /** The reporting tab. */
  tabId: number;
  /** The reporting frame. `undefined` for the top frame. */
  frameId: number | undefined;
  /** Browser-assigned UUID of the reporting document. Opaque; carries no page content. */
  documentId: string;
  /**
   * Epoch ms the report was stamped. Orders reports for a frame: an older report never replaces
   * a newer one, whatever order they are reported in. Wall-clock, so a clock stepping backwards can drop
   * a fresh report; that fails closed.
   */
  stampedAt: number;
  /**
   * Absolute epoch-ms deadline, exclusive: the report is expired at `now >= expiresAt`. Absolute,
   * not relative, so it survives an MV3 restart.
   */
  expiresAt: number;
}>;

/** The live facts of a frame that exists. */
export type LiveFrame = Readonly<{
  /**
   * A frame always has a `documentId` field. `undefined` when the browser declines to populate it.
   *
   * @see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Work_with_documentId
   */
  documentId: string | undefined;
}>;

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

/** What {@link feedTransitionBuffer} reads. */
export type BufferSources = {
  /** Stamped reports, as from `registerTransition`. */
  report$: Observable<BufferedTransitionReport>;
  /** Each state change the lifecycle machine reports, with its browser tab's id. */
  tabLifecycleChanged$: Observable<readonly [tabId: number, edge: TabEdge]>;
  /** Each frame that no longer exists. Not tied to the lifecycle machine. */
  frameLost$: Observable<Readonly<{ tabId: number; frameId: number | undefined }>>;
  /**
   * The id of each browser tab that is removed. The same source must end the tab's lifecycle
   * machine, or a change arriving after the removal brings the tab's lifecycle state back.
   */
  tabRemoved$: Observable<number>;
  /** Whether the buffer gathers. `false` clears it; it is disabled until this first emits. */
  enabled$: Observable<boolean>;
};
