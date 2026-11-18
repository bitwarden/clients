import { Observable } from "rxjs";

import type { TabEdge } from "../types";

import type { BufferedTransitionReport } from "./types";

/**
 * The buffer of `lifecycle.design.md`, "Buffering transitions". A reported transition is
 * reconciled against its tab's lifecycle state: it is **buffered** while its tab is cold, warming
 * up, or cooling down; **resolved** when its tab reaches hot, at once if the tab is already hot;
 * and **dropped** otherwise. The latest transition per `(tab, frame)` is kept: a fresh one
 * replaces the one before it.
 *
 * Beyond the design:
 *
 * - A transition is **older** than another for the same frame when its `stampedAt` is earlier.
 *   An older transition never replaces a newer one, whatever order they are reported in.
 * - A transition **expires** at its `expiresAt`. An expired transition is dropped at its next
 *   reconciliation: when its frame reports again, or when its tab's lifecycle state changes.
 * - A **disabled** buffer ignores reported transitions.
 */
export abstract class TransitionBuffer implements Disposable {
  /**
   * Each report that resolved into a fill opportunity.
   *
   * Resolution does not check that the document is still live, nor that its account is the active
   * one. Subscribers should check both before acting.
   */
  abstract readonly resolved$: Observable<BufferedTransitionReport>;

  /**
   * Reconciles a reported transition against its tab's lifecycle state. Buffers transitions
   * reported before its tab has any lifecycle state.
   */
  abstract report(report: BufferedTransitionReport): void;

  /**
   * Records a change to a tab's lifecycle state and reconciles its buffered transitions. A change
   * caused by a command consumes them instead of resolving them.
   */
  abstract lifecycleChanged(tabId: number, edge: TabEdge): void;

  /** Drops a frame's buffered transition, whatever its tab's lifecycle state. */
  abstract frameLost(tabId: number, frameId: number | undefined): void;

  /**
   * Drops a tab's buffered transitions, and forgets its lifecycle state and which of its
   * transitions are older.
   */
  abstract tabRemoved(tabId: number): void;

  /** `false` drops every buffered transition and disables the buffer; `true` enables it. */
  abstract setEnabled(enabled: boolean): void;

  /** Ends the subscriptions the buffer has taken and completes its observables. */
  abstract [Symbol.dispose](): void;
}
