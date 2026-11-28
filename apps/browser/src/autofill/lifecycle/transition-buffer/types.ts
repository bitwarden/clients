import type { Observable } from "rxjs";

import type { UserId } from "@bitwarden/common/types/guid";
import type { StateProvider } from "@bitwarden/state";

import type { CancellationToken } from "../../utils/cancellation";
import type { AccountEvent, TabEdge } from "../types";

import type { PageTransitionEventKind } from "./enums";

/**
 * A reported transition, stamped by `registerTransition` and reconciled by a `TransitionBuffer`.
 * This is the persisted shape: it identifies a document, and describes its page only by its tab's
 * URL, which selects the credential. Do not add other fields that describe the page, such as its
 * title. It is stored in memory, never on disk.
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
  /** The reporting tab's URL when the transition was reported. `undefined` when the browser gave none. */
  url: string | undefined;
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

/**
 * A transition that resolved into a fill opportunity. It identifies the document that reported it
 * without describing it, and carries the token that is cancelled when its release ends.
 */
export type ResolvedTransitionReport = Readonly<{
  /** The account active when the transition was reported. */
  userId: UserId;
  /** The reporting tab. */
  tabId: number;
  /** The reporting frame. `undefined` for the top frame. */
  frameId: number | undefined;
  /** Browser-assigned UUID of the reporting document. Opaque; carries no page content. */
  documentId: string;
  /** The reporting tab's URL when the transition was reported. It selects the credential. */
  url: string | undefined;
  /** Absolute epoch-ms deadline, exclusive: the transition is expired at `now >= expiresAt`. */
  expiresAt: number;
  /** Cancelled when the transition expires. The deadline does not cancel it. See `model.md`. */
  cancellation: CancellationToken;
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

/**
 * A page transition as the page lifecycle reports it. None of it comes from the page: a reporting
 * frame contributes the *fact of* a transition and nothing else. The browser supplies the rest.
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
  /** The reporting tab's URL, from `chrome.runtime.MessageSender`'s tab. */
  url: string | undefined;
}>;

/**
 * The signals the transition buffer's controller reads. The controller subscribes to each stream
 * once, and the operator that follows it reads the tab streams as well.
 */
export type PageTransitionSignals = Readonly<{
  /**
   * Each transition a frame reports. The report carries no account: the account active when it
   * arrives is assigned to it.
   */
  report$: Observable<Omit<TransitionReport, "userId">>;
  /** The history of the accounts, as from `accountEvents$`. */
  accountEvents$: Observable<AccountEvent>;
  /** Each state change the lifecycle machine reports, with its browser tab's id. */
  tabLifecycleChanged$: Observable<readonly [tabId: number, edge: TabEdge]>;
  /** The id of each browser tab that is removed. */
  tabRemoved$: Observable<number>;
  /** Each frame that no longer exists. Never a frame whose tab stopped monitoring. */
  frameLost$: Observable<Readonly<{ tabId: number; frameId: number | undefined }>>;
  /** Emits when the autofill scripts are about to be injected into every frame anew. */
  scriptsReloading$: Observable<unknown>;
}>;

/** What a page-transition resolver is built from. None of it is a signal. */
export type PageTransitionDependencies = Readonly<{
  /** Where the buffer is stored. */
  stateProvider: StateProvider;
  /** Epoch ms: the clock that transitions are stamped and expired by. */
  now: () => number;
  /** How long a transition stays actionable, in milliseconds. Its latest value is read for each report. */
  maxAgeMs$: Observable<number>;
  /** Called when the buffer's storage fails, before the buffer continues in memory. */
  onStorageFailure: (error: unknown) => void;
}>;

/** An event the controller applies, in the order it arrives. See `pageTransitionEvents$`. */
export type PageTransitionEvent =
  | Readonly<{
      kind: typeof PageTransitionEventKind.Report;
      report: Omit<TransitionReport, "userId">;
    }>
  | Readonly<{ kind: typeof PageTransitionEventKind.Account; event: AccountEvent }>
  | Readonly<{ kind: typeof PageTransitionEventKind.MaxAge; ms: number }>
  | Readonly<{ kind: typeof PageTransitionEventKind.TabChanged; tabId: number; edge: TabEdge }>
  | Readonly<{ kind: typeof PageTransitionEventKind.TabRemoved; tabId: number }>
  | Readonly<{
      kind: typeof PageTransitionEventKind.FrameLost;
      tabId: number;
      frameId: number | undefined;
    }>
  | Readonly<{ kind: typeof PageTransitionEventKind.ScriptsReloading }>
  | Readonly<{ kind: typeof PageTransitionEventKind.Restored; report: BufferedTransitionReport }>;
