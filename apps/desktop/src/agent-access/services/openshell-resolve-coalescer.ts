import { Observable, Subject } from "rxjs";

import {
  OPENSHELL_CARRY_WINDOW_MS,
  OPENSHELL_DELIVERED_DEDUPE_MS,
  OPENSHELL_DIALOG_LINGER_MS,
  OPENSHELL_DIALOG_MAX_MS,
  OpenShellLifetimeMode,
} from "../models/openshell";

/** The lifetime an approval releases. Computed once, when the user approves. */
export interface OpenShellDecisionLifetime {
  mode: OpenShellLifetimeMode;
  expiresAtMs?: number;
}

/** A user decision for one exact request key. Never holds a credential value. */
export type OpenShellDecision =
  { kind: "approved"; lifetime: OpenShellDecisionLifetime } | { kind: "denied" };

/**
 * A decision kept for its key (§M8.18): approved-and-undelivered or denied for
 * `OPENSHELL_CARRY_WINDOW_MS` after the decision, approved-and-delivered for
 * `OPENSHELL_DELIVERED_DEDUPE_MS` after the first delivery.
 */
export interface CarriedOpenShellDecision {
  readonly decision: OpenShellDecision;
  /** Approved only: whether a reply carrying it has been confirmed delivered. */
  delivered: boolean;
  expiresAtMs: number;
}

export type OpenShellWaitResult =
  { kind: "decided"; carried: CarriedOpenShellDecision } | { kind: "timeout" };

/** What the dialog returned (`undefined` when it was closed without a button, e.g. Escape). */
export type OpenShellDialogResult = "approved" | "denied" | "timeout" | undefined;

/** The opened dialog, as the coalescer needs it. */
export interface OpenShellDialogHandle {
  closed: Promise<OpenShellDialogResult>;
  close(): void;
}

/**
 * Opens the UI. `initialRemainingMs` is the countdown to start from; `deadlineUpdates` emits a new
 * remaining time (ms) whenever an attached retry keeps the dialog open longer.
 */
export type OpenShellDialogOpener = (
  initialRemainingMs: number,
  deadlineUpdates: Observable<number>,
) => OpenShellDialogHandle;

interface Waiter {
  resolve: (result: OpenShellWaitResult) => void;
  timer: ReturnType<typeof setTimeout>;
  replyByMs: number;
}

interface OpenDialog {
  waiters: Set<Waiter>;
  openedAtMs: number;
  closesAtMs: number;
  deadlineUpdates: Subject<number>;
  handle?: OpenShellDialogHandle;
  /** Set by `clear()`: whatever the dialog returns afterwards is ignored. */
  cleared: boolean;
}

/**
 * Coalesces OpenShell resolves that are the same request (agent-access-architecture.md, §M8.18).
 *
 * - While a dialog for a key is open, an identical resolve **attaches** to it instead of opening
 *   another. Each attached request still answers within its own deadline: one whose deadline
 *   passes gets `timeout`, and the dialog stays open (`OPENSHELL_DIALOG_LINGER_MS` past the last
 *   attached deadline, at most `OPENSHELL_DIALOG_MAX_MS`) for the supervisor's next retry.
 * - A decision is **carried** for its exact key: approved-but-undelivered and denied for
 *   `OPENSHELL_CARRY_WINDOW_MS`, so a retry is answered at once with no dialog. A carried approval
 *   becomes a **delivered** one on its first confirmed delivery, which is then reusable only for
 *   `OPENSHELL_DELIVERED_DEDUPE_MS` (OpenShell's second resolve of the same load).
 *
 * Keys are exact strings (see `openShellCoalescingKey`): any difference means a new dialog. State
 * is in memory only, holds no values, and `clear()` drops all of it (lock, logout, account
 * switch, toggle off). An unanswered dialog (its countdown ran out) carries nothing.
 */
export class OpenShellResolveCoalescer {
  private readonly decisions = new Map<string, CarriedOpenShellDecision>();
  private readonly dialogs = new Map<string, OpenDialog>();

  constructor(private readonly now: () => number) {}

  /** The live carried decision for `key`, if any (expired ones are dropped). */
  decisionFor(key: string): CarriedOpenShellDecision | undefined {
    const carried = this.decisions.get(key);
    if (carried == null) {
      return undefined;
    }
    if (carried.expiresAtMs <= this.now()) {
      this.decisions.delete(key);
      return undefined;
    }
    return carried;
  }

  hasDialog(key: string): boolean {
    return this.dialogs.has(key);
  }

  /** Whether a resolve for `key` would be answered from a decision or an open dialog. */
  isKnown(key: string): boolean {
    return this.decisionFor(key) != null || this.hasDialog(key);
  }

  /**
   * Attaches a request to the open dialog for `key`, or answers it from a carried decision.
   * Resolves with the decision, or `timeout` at `decisionByMs` (or at once when nothing is there).
   */
  wait(key: string, decisionByMs: number): Promise<OpenShellWaitResult> {
    const carried = this.decisionFor(key);
    if (carried != null) {
      return Promise.resolve({ kind: "decided", carried });
    }
    const dialog = this.dialogs.get(key);
    if (dialog == null) {
      return Promise.resolve({ kind: "timeout" });
    }
    return this.attach(dialog, decisionByMs);
  }

  /**
   * Opens the one dialog for `key` with the first request attached, and returns that request's
   * result plus a promise that settles when the dialog has closed (the caller holds the renderer
   * pipeline until then, so no other dialog stacks on top of it). `approvedLifetime` is called
   * once, when the user approves.
   */
  open(
    key: string,
    decisionByMs: number,
    opener: OpenShellDialogOpener,
    approvedLifetime: () => OpenShellDecisionLifetime,
  ): { result: Promise<OpenShellWaitResult>; closed: Promise<void> } {
    const now = this.now();
    const dialog: OpenDialog = {
      waiters: new Set(),
      openedAtMs: now,
      closesAtMs: 0,
      deadlineUpdates: new Subject<number>(),
      cleared: false,
    };
    dialog.closesAtMs = this.closesAt(dialog, decisionByMs);
    this.dialogs.set(key, dialog);
    // Attach before opening: a dialog may report its result synchronously.
    const result = this.attach(dialog, decisionByMs);

    let handle: OpenShellDialogHandle;
    try {
      handle = opener(dialog.closesAtMs - now, dialog.deadlineUpdates.asObservable());
    } catch (e) {
      // A dialog that never opened decides nothing.
      this.finish(key, dialog, "timeout");
      throw e;
    }
    dialog.handle = handle;
    const closed = handle.closed.then(
      (outcome) => this.finish(key, dialog, outcome, approvedLifetime),
      () => this.finish(key, dialog, "timeout"),
    );
    return { result, closed };
  }

  /**
   * Marks a carried approval delivered. Returns `true` only the first time, which is when the
   * caller persists the grant and records the release events (one approval, one release). The
   * decision then stays reusable for `OPENSHELL_DELIVERED_DEDUPE_MS` from now.
   */
  markDelivered(carried: CarriedOpenShellDecision): boolean {
    if (carried.decision.kind !== "approved" || carried.delivered) {
      return false;
    }
    carried.delivered = true;
    carried.expiresAtMs = this.now() + OPENSHELL_DELIVERED_DEDUPE_MS;
    return true;
  }

  /** Drops every decision and closes every open dialog; waiting requests time out. */
  clear(): void {
    this.decisions.clear();
    for (const [key, dialog] of [...this.dialogs]) {
      dialog.cleared = true;
      this.dialogs.delete(key);
      this.releaseWaiters(dialog, { kind: "timeout" });
      dialog.deadlineUpdates.complete();
      try {
        dialog.handle?.close();
      } catch {
        // The dialog may already be gone; nothing else to undo.
      }
    }
  }

  private attach(dialog: OpenDialog, decisionByMs: number): Promise<OpenShellWaitResult> {
    return new Promise((resolve) => {
      const waiter: Waiter = {
        resolve,
        replyByMs: decisionByMs,
        timer: setTimeout(
          () => {
            dialog.waiters.delete(waiter);
            resolve({ kind: "timeout" });
          },
          Math.max(0, decisionByMs - this.now()),
        ),
      };
      dialog.waiters.add(waiter);
      const closesAtMs = this.closesAt(dialog, decisionByMs);
      if (closesAtMs > dialog.closesAtMs) {
        dialog.closesAtMs = closesAtMs;
        dialog.deadlineUpdates.next(closesAtMs - this.now());
      }
    });
  }

  private closesAt(dialog: OpenDialog, decisionByMs: number): number {
    return Math.min(
      dialog.openedAtMs + OPENSHELL_DIALOG_MAX_MS,
      Math.max(dialog.closesAtMs, decisionByMs + OPENSHELL_DIALOG_LINGER_MS),
    );
  }

  private finish(
    key: string,
    dialog: OpenDialog,
    outcome: OpenShellDialogResult,
    approvedLifetime?: () => OpenShellDecisionLifetime,
  ): void {
    // `approvedLifetime` is absent only on the error paths, which decide nothing.
    if (this.dialogs.get(key) === dialog) {
      this.dialogs.delete(key);
    }
    dialog.deadlineUpdates.complete();
    if (dialog.cleared) {
      return;
    }
    // An unanswered dialog (countdown ran out) decides nothing and carries nothing. Anything
    // but an explicit approval is a denial (Deny, Escape, closed).
    if (outcome === "timeout" || approvedLifetime == null) {
      this.releaseWaiters(dialog, { kind: "timeout" });
      return;
    }
    const decision: OpenShellDecision =
      outcome === "approved"
        ? { kind: "approved", lifetime: approvedLifetime() }
        : { kind: "denied" };
    const carried: CarriedOpenShellDecision = {
      decision,
      delivered: false,
      expiresAtMs: this.now() + OPENSHELL_CARRY_WINDOW_MS,
    };
    this.decisions.set(key, carried);
    this.releaseWaiters(dialog, { kind: "decided", carried });
  }

  private releaseWaiters(dialog: OpenDialog, result: OpenShellWaitResult): void {
    for (const waiter of dialog.waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(result);
    }
    dialog.waiters.clear();
  }
}
