import { merge, Observable, Subject, Subscription } from "rxjs";

import type { UserId } from "@bitwarden/common/types/guid";

import { AccountEventKind } from "../enums";
import type { AccountEvent, TabEdge } from "../types";

import { TransitionBuffer } from "./abstractions";
import { edgeBufferAction, reportBufferAction } from "./actions";
import { BufferAction, PageTransitionEventKind } from "./enums";
import { pageTransitionEvents$ } from "./transition-buffer-controller.rx";
import type {
  BufferedTransitionReport,
  PageTransitionEvent,
  PageTransitionSignals,
  TransitionReport,
} from "./types";
import { registerTransition } from "./utils";

/** A report that has arrived and is waiting to be judged. */
type Arrival = Readonly<{
  report: Omit<TransitionReport, "userId">;
  /** The moment the report arrived: the transition is stamped with it, not with the moment it is judged. */
  arrivedAt: number;
  /** The account active when the report arrived, if the accounts were known then. */
  userId: UserId | undefined;
}>;

/**
 * Directs a {@link TransitionBuffer} from the signals of its environment. See `model.md`.
 *
 * The controller stamps each report with the account active when it arrives, and decides from the
 * tab's disposition whether the transition is buffered, resolved at once, or dropped. It reads the
 * lifecycle's changes of state as they occur and keeps the disposition each implies for each tab,
 * and nothing else about the tab. Changes of state, and of frames, tabs, accounts, and the
 * extension's scripts, become instructions to the buffer. A transition the buffer restored from
 * storage is judged by its tab's disposition like any other.
 *
 * A report that arrives before the accounts are observed, or before the age bound is known, waits
 * and is judged in the order it arrived. A tab that has reported no change buffers. A tab that was
 * removed stays removed: a report for it is dropped.
 *
 * The controller subscribes to its signals when it is constructed, and applies their events one at
 * a time, in the order they arrive, even when applying one causes another
 * ({@link pageTransitionEvents$}). It does not own the buffer. See `patterns.md`, "The controller".
 */
export class TransitionBufferController implements Disposable {
  private readonly dispositions = new Map<number, BufferAction>();
  private readonly removedTabs = new Set<number>();
  private readonly signedIn = new Set<UserId>();
  private active: UserId | undefined;
  private bootstrapped = false;
  private admitting = false;
  private maxAgeMs: number | undefined;
  private waiting: Arrival[] = [];
  private readonly pending: PageTransitionEvent[] = [];
  private applying = false;
  private readonly resolvedReports = new Subject<BufferedTransitionReport>();
  private readonly subscription: Subscription;

  /**
   * Each transition that resolved into a fill opportunity. Errors when a signal fails; the buffer
   * is then no longer directed.
   */
  readonly resolved$: Observable<BufferedTransitionReport>;

  /**
   * @param signals What the controller reads.
   * @param buffer The buffer the controller directs. Its only driver.
   * @param options.now Epoch ms: the clock that transitions are stamped by.
   * @param options.maxAgeMs$ How long a transition stays actionable, in milliseconds.
   */
  constructor(
    signals: PageTransitionSignals,
    private readonly buffer: TransitionBuffer,
    private readonly options: Readonly<{ now: () => number; maxAgeMs$: Observable<number> }>,
  ) {
    this.resolved$ = merge(buffer.resolved$, this.resolvedReports);
    this.subscription = pageTransitionEvents$(
      signals,
      options.maxAgeMs$,
      buffer.restored$,
    ).subscribe({
      next: (event) => this.enqueue(event),
      error: (error: unknown) => this.resolvedReports.error(error),
    });
  }

  [Symbol.dispose](): void {
    this.subscription.unsubscribe();
    this.dispositions.clear();
    this.removedTabs.clear();
    this.waiting = [];
    this.pending.length = 0;
    this.resolvedReports.complete();
  }

  /**
   * Applies events one at a time. An event that arrives while another is being applied, because
   * applying it caused one, waits its turn.
   */
  private enqueue(event: PageTransitionEvent): void {
    this.pending.push(event);
    if (this.applying) {
      return;
    }
    this.applying = true;
    try {
      for (let next = this.pending.shift(); next; next = this.pending.shift()) {
        this.apply(next);
      }
    } finally {
      this.applying = false;
    }
  }

  private apply(event: PageTransitionEvent): void {
    switch (event.kind) {
      case PageTransitionEventKind.Report:
        return this.report(event.report);

      case PageTransitionEventKind.Account:
        return this.account(event.event);

      case PageTransitionEventKind.MaxAge:
        this.maxAgeMs = event.ms;
        return this.release();

      case PageTransitionEventKind.TabChanged:
        return this.tabChanged(event.tabId, event.edge);

      case PageTransitionEventKind.TabRemoved:
        this.removedTabs.add(event.tabId);
        this.dispositions.delete(event.tabId);
        this.waiting = this.waiting.filter(({ report }) => report.tabId !== event.tabId);
        return this.buffer.forget(event.tabId);

      case PageTransitionEventKind.FrameLost:
        this.waiting = this.waiting.filter(
          ({ report }) => report.tabId !== event.tabId || report.frameId !== event.frameId,
        );
        return this.buffer.dropFrame(event.tabId, event.frameId);

      case PageTransitionEventKind.ScriptsReloading:
        // The scripts that reported are replaced, so what was waiting on them is cleared.
        this.waiting = [];
        if (this.bootstrapped && this.admitting) {
          this.buffer.clear();
        }
        return;

      case PageTransitionEventKind.Restored:
        return this.route(event.report);
    }
  }

  private report(report: Omit<TransitionReport, "userId">): void {
    const arrival: Arrival = {
      report,
      arrivedAt: this.options.now(),
      userId: this.bootstrapped ? this.active : undefined,
    };
    if (this.ready) {
      this.judge(arrival);
    } else {
      this.waiting.push(arrival);
    }
  }

  /** Stamps a report as of its arrival and routes it. */
  private judge({ report, arrivedAt, userId }: Arrival): void {
    const stamped = registerTransition(
      { ...report, userId: userId ?? this.active },
      { now: arrivedAt, maxAgeMs: this.maxAgeMs! },
    );
    if (stamped) {
      this.route(stamped);
    }
  }

  /** Buffers, resolves, or drops a stamped transition, as its tab's disposition says. */
  private route(stamped: BufferedTransitionReport): void {
    if (!this.admitting || this.removedTabs.has(stamped.tabId)) {
      return;
    }

    switch (this.dispositions.get(stamped.tabId) ?? BufferAction.Buffer) {
      case BufferAction.Buffer:
        return this.buffer.buffer(stamped);

      case BufferAction.Resolve:
        // passes by the buffer, so nothing is stored, but an expired transition never resolves
        if (this.options.now() < stamped.expiresAt) {
          this.resolvedReports.next(stamped);
        }
        return;

      case BufferAction.Drop:
        return;
    }
  }

  private tabChanged(tabId: number, edge: TabEdge): void {
    // recorded before the buffer is instructed, so what hears of the instruction finds it current
    this.dispositions.set(tabId, reportBufferAction(edge));
    const action = edgeBufferAction(edge);
    if (action === BufferAction.Resolve) {
      this.buffer.resolve(tabId);
    } else if (action === BufferAction.Drop) {
      this.buffer.drop(tabId);
    }
  }

  private account(event: AccountEvent): void {
    const was = this.admitting;
    if (event.kind === AccountEventKind.Login) {
      this.signedIn.add(event.userId);
    } else if (event.kind === AccountEventKind.Logout) {
      this.signedIn.delete(event.userId);
    } else if (event.kind === AccountEventKind.Switch) {
      this.active = event.to;
    }
    this.admitting = this.active !== undefined && this.signedIn.has(this.active);

    if (event.kind === AccountEventKind.Bootstrapped) {
      this.bootstrapped = true;
      this.buffer.setEnabled(this.admitting);
      return this.release();
    }
    if (!this.bootstrapped) {
      return;
    }

    // The session the waiting transitions belonged to has ended when the active account locks or
    // changes, while admission continues.
    const sessionEnded =
      event.kind === AccountEventKind.Switch ||
      (event.kind === AccountEventKind.Lock && event.userId === this.active);
    if (sessionEnded && was && this.admitting) {
      this.waiting = [];
      this.buffer.clear();
    } else if (this.admitting !== was) {
      this.waiting = [];
      this.buffer.setEnabled(this.admitting);
    }
  }

  /** Whether the controller can judge a report: the accounts and the age bound are known. */
  private get ready(): boolean {
    return this.bootstrapped && this.maxAgeMs !== undefined;
  }

  /** Judges the reports that waited, in the order they arrived. */
  private release(): void {
    if (!this.ready) {
      return;
    }
    const waiting = this.waiting;
    this.waiting = [];
    waiting.forEach((arrival) => this.judge(arrival));
  }
}
