import { Subject } from "rxjs";

import type { TabEdge } from "../types";
import { edgeBufferAction, reportBufferAction } from "../utils";

import { TransitionBuffer } from "./abstractions";
import type { BufferedTransitionReport } from "./types";
import { transitionKey } from "./utils";

/**
 * A {@link TransitionBuffer} in memory. A transition its tab resolves at once is never buffered.
 *
 * Disabled until {@link DefaultTransitionBuffer.setEnabled} enables it. Disabling forgets which
 * transitions are older, but keeps tab lifecycle states, since they describe the tabs rather than
 * the session.
 *
 * No timer is scheduled for expiry: an expired transition stays buffered until its next
 * reconciliation.
 */
export class DefaultTransitionBuffer implements TransitionBuffer {
  private readonly entries = new Map<string, BufferedTransitionReport>();
  private readonly latestEdges = new Map<number, TabEdge>();
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

  /** @param now Epoch ms: the same clock `registerTransition` is stamped from. */
  constructor(private readonly now: () => number) {}

  /**
   * What is buffered, keyed by {@link transitionKey}. This map is shared.
   * If you need a fixed map, copy it synchronously.
   */
  get buffered(): ReadonlyMap<string, BufferedTransitionReport> {
    return this.entries;
  }

  report(report: BufferedTransitionReport): void {
    if (!this.enabled) {
      return;
    }

    // an older transition never replaces a newer one, whatever order they are reported in
    const key = transitionKey(report);
    if (report.stampedAt < (this.latestStamps.get(key) ?? Number.NEGATIVE_INFINITY)) {
      return;
    }
    this.latestStamps.set(key, report.stampedAt);

    const action = this.isExpired(report)
      ? "drop"
      : reportBufferAction(this.latestEdges.get(report.tabId));
    const replaced = this.entries.delete(key);
    if (action === "keep") {
      this.entries.set(key, report);
    }
    if (replaced || action === "keep") {
      this.bufferedChanged.next(this.entries);
    }
    if (action === "resolve") {
      this.resolvedReports.next(report);
    }
  }

  lifecycleChanged(tabId: number, edge: TabEdge): void {
    this.latestEdges.set(tabId, edge);

    let changed = false;
    const resolved: BufferedTransitionReport[] = [];
    for (const [key, report] of this.entries) {
      if (report.tabId !== tabId) {
        continue;
      }
      const action = this.isExpired(report) ? "drop" : edgeBufferAction(edge);
      if (action !== "keep") {
        this.entries.delete(key);
        changed = true;
        if (action === "resolve") {
          resolved.push(report);
        }
      }
    }

    if (changed) {
      this.bufferedChanged.next(this.entries);
    }
    resolved.forEach((report) => this.resolvedReports.next(report));
  }

  frameLost(tabId: number, frameId: number | undefined): void {
    if (this.entries.delete(transitionKey({ tabId, frameId }))) {
      this.bufferedChanged.next(this.entries);
    }
  }

  tabRemoved(tabId: number): void {
    this.latestEdges.delete(tabId);
    // a frame's key begins with its tab's id
    for (const key of this.latestStamps.keys()) {
      if (key.startsWith(`${tabId}:`)) {
        this.latestStamps.delete(key);
      }
    }

    let changed = false;
    for (const [key, report] of this.entries) {
      if (report.tabId === tabId) {
        changed = this.entries.delete(key) || changed;
      }
    }
    if (changed) {
      this.bufferedChanged.next(this.entries);
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.entries.clear();
      this.latestStamps.clear();
      // emitted even when empty, so a copy that outlived the buffer is cleared too
      this.bufferedChanged.next(this.entries);
    }
  }

  [Symbol.dispose](): void {
    this.bufferedChanged.complete();
    this.resolvedReports.complete();
  }

  private isExpired(report: BufferedTransitionReport): boolean {
    return this.now() >= report.expiresAt;
  }
}
