import { Observable, Subject, Subscription } from "rxjs";

import type { StateProvider } from "@bitwarden/state";

import { TransitionBuffer } from "./abstractions";
import { DefaultTransitionBuffer } from "./default-buffer";
import {
  BUFFERED_TRANSITIONS,
  PersistentTransitionBuffer,
  resetTransitionBuffer,
} from "./persistent-buffer";
import type { BufferedTransitionReport } from "./types";

/**
 * A {@link TransitionBuffer} that is stored while storage works, and in memory when it does not.
 * See `model.md`, invariant 10.
 *
 * A storage failure is reported, the stored record is discarded, and a buffer in memory replaces
 * the stored one with the admission it had. What was waiting at the moment of failure is lost.
 * Persistence stays off until the buffer is rebuilt. The buffer needs nothing else to carry on,
 * because it keeps no state about tabs.
 */
export class ResilientTransitionBuffer implements TransitionBuffer {
  private current: TransitionBuffer;
  private following: Subscription;
  private enabled: boolean | undefined;
  private readonly resolvedReports = new Subject<BufferedTransitionReport>();
  private readonly restoredReports = new Subject<BufferedTransitionReport>();

  readonly resolved$: Observable<BufferedTransitionReport> = this.resolvedReports.asObservable();
  readonly restored$: Observable<BufferedTransitionReport> = this.restoredReports.asObservable();

  /**
   * @param stateProvider Where the buffer is stored.
   * @param now Epoch ms: the clock the transitions are stamped from.
   * @param onStorageFailure Called with the failure of storage, before the buffer continues in memory.
   */
  constructor(
    private readonly stateProvider: StateProvider,
    private readonly now: () => number,
    private readonly onStorageFailure: (error: unknown) => void,
  ) {
    this.current = new PersistentTransitionBuffer(
      stateProvider.getGlobal(BUFFERED_TRANSITIONS),
      now,
    );
    this.following = this.follow(this.current);
  }

  buffer(report: BufferedTransitionReport): void {
    this.current.buffer(report);
  }

  resolve(tabId: number): void {
    this.current.resolve(tabId);
  }

  drop(tabId: number): void {
    this.current.drop(tabId);
  }

  dropFrame(tabId: number, frameId: number | undefined): void {
    this.current.dropFrame(tabId, frameId);
  }

  forget(tabId: number): void {
    this.current.forget(tabId);
  }

  clear(): void {
    this.current.clear();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.current.setEnabled(enabled);
  }

  [Symbol.dispose](): void {
    this.following.unsubscribe();
    this.current[Symbol.dispose]();
    this.resolvedReports.complete();
    this.restoredReports.complete();
  }

  private follow(buffer: TransitionBuffer): Subscription {
    const following = new Subscription();
    following.add(buffer.restored$.subscribe((report) => this.restoredReports.next(report)));
    following.add(
      buffer.resolved$.subscribe({
        next: (report) => this.resolvedReports.next(report),
        error: (error: unknown) => this.failOver(error),
      }),
    );
    return following;
  }

  private failOver(error: unknown): void {
    // The buffer in memory takes over first, so a failure handler that throws cannot leave a
    // buffer that has stopped in its place.
    this.current = new DefaultTransitionBuffer(this.now);
    if (this.enabled !== undefined) {
      this.current.setEnabled(this.enabled);
    }
    this.following = this.follow(this.current);

    this.onStorageFailure(error);
    resetTransitionBuffer(this.stateProvider).catch(this.onStorageFailure);
  }
}
