import type { UserId } from "@bitwarden/common/types/guid";

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

/**
 * Buffered reports, keyed by {@link transitionKey}.
 *
 * WARNING: These reports are shared across accounts. You must verify the active account
 * against stored records to avoid cross-account replays.
 */
export type BufferedTransitions = Record<string, BufferedTransitionReport>;
