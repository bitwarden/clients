import { EMPTY, Observable, Subject } from "rxjs";

import { TransitionBuffer } from "./abstractions";
import type { BufferedTransitionReport } from "./types";
import { transitionKey } from "./utils";

/**
 * A {@link TransitionBuffer} in memory. See `model.md`.
 *
 * Disabled until {@link DefaultTransitionBuffer.setEnabled} enables it. No timer is scheduled for
 * expiry: an expired transition stays buffered until it is replaced or dropped, and is never
 * resolved.
 */
export class DefaultTransitionBuffer implements TransitionBuffer {
  private readonly entries = new Map<string, BufferedTransitionReport>();
  private readonly latestStamps = new Map<string, number>();
  private enabled = false;
  private readonly bufferedChanged = new Subject<ReadonlyMap<string, BufferedTransitionReport>>();
  private readonly resolvedReports = new Subject<BufferedTransitionReport>();

  /**
   * What is buffered after every change. Each emission is
   * {@link DefaultTransitionBuffer.buffered} itself, updated in place. If you need a fixed map,
   * copy it synchronously.
   */
  readonly buffered$ = this.bufferedChanged.asObservable();

  readonly resolved$ = this.resolvedReports.asObservable();

  /** Nothing is stored, so nothing is restored. */
  readonly restored$: Observable<BufferedTransitionReport> = EMPTY;

  /** @param now Epoch ms: the same clock the transitions are stamped from. */
  constructor(private readonly now: () => number) {}

  /**
   * What is buffered, keyed by {@link transitionKey}. This map is shared.
   * If you need a fixed map, copy it synchronously.
   */
  get buffered(): ReadonlyMap<string, BufferedTransitionReport> {
    return this.entries;
  }

  buffer(report: BufferedTransitionReport): void {
    if (!this.enabled) {
      return;
    }

    // an older transition never replaces a newer one, whatever order they arrive in
    const key = transitionKey(report);
    if (report.stampedAt < (this.latestStamps.get(key) ?? Number.NEGATIVE_INFINITY)) {
      return;
    }
    this.latestStamps.set(key, report.stampedAt);

    const replaced = this.entries.delete(key);
    const stored = !this.isExpired(report);
    if (stored) {
      this.entries.set(key, report);
    }
    if (replaced || stored) {
      this.bufferedChanged.next(this.entries);
    }
  }

  resolve(tabId: number): void {
    const released = this.take(tabId);
    released
      .filter((report) => !this.isExpired(report))
      .forEach((report) => this.resolvedReports.next(report));
  }

  drop(tabId: number): void {
    this.take(tabId);
  }

  dropFrame(tabId: number, frameId: number | undefined): void {
    if (this.entries.delete(transitionKey({ tabId, frameId }))) {
      this.bufferedChanged.next(this.entries);
    }
  }

  forget(tabId: number): void {
    this.take(tabId);
    // a frame's key begins with its tab's id
    for (const key of this.latestStamps.keys()) {
      if (key.startsWith(`${tabId}:`)) {
        this.latestStamps.delete(key);
      }
    }
  }

  clear(): void {
    this.entries.clear();
    this.latestStamps.clear();
    // emitted even when empty, so a copy that outlived the buffer is cleared too
    this.bufferedChanged.next(this.entries);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  [Symbol.dispose](): void {
    this.bufferedChanged.complete();
    this.resolvedReports.complete();
  }

  /** Removes a tab's transitions from the buffer and returns them. */
  private take(tabId: number): BufferedTransitionReport[] {
    const taken: BufferedTransitionReport[] = [];
    for (const [key, report] of this.entries) {
      if (report.tabId === tabId) {
        this.entries.delete(key);
        taken.push(report);
      }
    }
    if (taken.length > 0) {
      this.bufferedChanged.next(this.entries);
    }
    return taken;
  }

  private isExpired(report: BufferedTransitionReport): boolean {
    return this.now() >= report.expiresAt;
  }
}
