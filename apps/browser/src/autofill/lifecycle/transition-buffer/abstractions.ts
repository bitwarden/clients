import { Observable } from "rxjs";

import type { BufferedTransitionReport } from "./types";

/**
 * The buffer of `model.md`: a store of transitions that wait for their tab to be hot. It holds the
 * latest transition for each frame, and acts only on instruction. It knows nothing of tab states.
 *
 * Beyond the model:
 *
 * - A transition is **older** than another for the same frame when its `stampedAt` is earlier. An
 *   older transition never replaces a newer one, whatever order they arrive in.
 * - A transition **expires** at its `expiresAt`. An expired transition is never buffered and never
 *   resolved. It may remain buffered until it is replaced or dropped.
 * - A **disabled** buffer ignores the transitions it is given.
 */
export abstract class TransitionBuffer implements Disposable {
  /**
   * Each transition that resolved into a fill opportunity.
   *
   * Resolution does not check that the document is still live, nor that its account is the active
   * one. Subscribers should check both before acting.
   */
  abstract readonly resolved$: Observable<BufferedTransitionReport>;

  /**
   * Each transition that was restored from storage. The buffer does not buffer it: its tab's
   * disposition decides what it deserves, as it does for any other transition, so the buffer is
   * told to buffer, resolve, or drop it.
   */
  abstract readonly restored$: Observable<BufferedTransitionReport>;

  /** Holds a transition until its tab is told to resolve or drop it. */
  abstract buffer(report: BufferedTransitionReport): void;

  /** Resolves a tab's transitions that have not expired, and drops the rest. */
  abstract resolve(tabId: number): void;

  /** Drops a tab's transitions. */
  abstract drop(tabId: number): void;

  /** Drops a frame's transition. */
  abstract dropFrame(tabId: number, frameId: number | undefined): void;

  /** Drops a tab's transitions, and forgets which of them are older. */
  abstract forget(tabId: number): void;

  /** Drops every transition, and forgets which are older. The buffer stays as enabled as it was. */
  abstract clear(): void;

  /** `false` clears the buffer and disables it; `true` enables it. */
  abstract setEnabled(enabled: boolean): void;

  /** Ends the subscriptions the buffer has taken and completes its observables. */
  abstract [Symbol.dispose](): void;
}
