import { firstValueFrom, Subject, Subscription } from "rxjs";

import {
  AUTOFILL_TAB_LIFECYCLE_MEMORY,
  GlobalState,
  KeyDefinition,
  StateProvider,
} from "@bitwarden/state";

import type { TabEdge } from "../types";

import { TransitionBuffer } from "./abstractions";
import { DefaultTransitionBuffer } from "./default";
import type { BufferedTransitionReport, BufferedTransitions } from "./types";

/**
 * Validates that an entry has the structure of a `BufferedTransitionReport`.
 */
function isBufferedTransitionReport(value: unknown): value is BufferedTransitionReport {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.userId === "string" &&
    entry.userId.length > 0 &&
    typeof entry.tabId === "number" &&
    (entry.frameId === undefined || typeof entry.frameId === "number") &&
    typeof entry.documentId === "string" &&
    entry.documentId.length > 0 &&
    typeof entry.stampedAt === "number" &&
    Number.isFinite(entry.stampedAt) &&
    typeof entry.expiresAt === "number" &&
    Number.isFinite(entry.expiresAt)
  );
}

/**
 * Stores buffered transitions across extension restarts; shared globally across users.
 * Entries that fail validation are dropped on load.
 *
 * WARNING: These reports are shared across accounts. You must verify the active account
 * against stored records to avoid cross-account replays.
 */
export const BUFFERED_TRANSITIONS = new KeyDefinition<BufferedTransitions>(
  AUTOFILL_TAB_LIFECYCLE_MEMORY,
  "bufferedTransitions",
  {
    deserializer: (value) => {
      const entries = Object.entries(value ?? {}).filter(([, entry]) =>
        isBufferedTransitionReport(entry),
      );
      return Object.fromEntries(entries) as BufferedTransitions;
    },
  },
);

/**
 * Extends {@link DefaultTransitionBuffer} to survive an MV3 restart.
 *
 * Storage is a copy of what is buffered. A report resolved since the last write that landed is
 * still stored until the next one does, and is restored and resolved again if the worker restarts
 * between a buffer change and the next write. Writes run one at a time in the order they were
 * received.
 *
 * The first {@link PersistentTransitionBuffer.setEnabled} decides what happens to the stored
 * record: `true` restores the unexpired reports it finds, which take the same path as fresh ones;
 * `false` restores nothing, and its clear empties storage. A clear while the record is still being
 * read discards it.
 *
 * Storage that fails, reading or writing, errors {@link PersistentTransitionBuffer.resolved$}. Once
 * a failure occurs, the buffer neither writes nor emits and must be rebuilt to resume operation.
 *
 * Use {@link resetTransitionBuffer} to categorically discard transitions.
 */
export class PersistentTransitionBuffer implements TransitionBuffer {
  private readonly buffer: DefaultTransitionBuffer;
  private readonly subscriptions = new Subscription();
  private readonly resolvedReports = new Subject<BufferedTransitionReport>();
  private readonly loaded: Promise<BufferedTransitions | null>;
  private saving: Promise<unknown>;
  private writePending = false;
  private started = false;
  private clears = 0;
  private stopped = false;

  readonly resolved$ = this.resolvedReports.asObservable();

  /**
   * @param state Where the buffer is stored. Each instance writes the whole record, so only one may
   *   use it at a time.
   * @param now Epoch ms: the same clock `registerTransition` is stamped from.
   */
  constructor(
    private readonly state: GlobalState<BufferedTransitions>,
    private readonly now: () => number,
  ) {
    this.buffer = new DefaultTransitionBuffer(now);
    this.loaded = firstValueFrom(state.state$);
    this.saving = this.loaded.catch((error: unknown) => this.fail(error));
    this.subscriptions.add(this.buffer.buffered$.subscribe(() => this.save()));
    this.subscriptions.add(
      this.buffer.resolved$.subscribe((report) => this.resolvedReports.next(report)),
    );
  }

  report(report: BufferedTransitionReport): void {
    this.buffer.report(report);
  }

  lifecycleChanged(tabId: number, edge: TabEdge): void {
    this.buffer.lifecycleChanged(tabId, edge);
  }

  frameLost(tabId: number, frameId: number | undefined): void {
    this.buffer.frameLost(tabId, frameId);
  }

  tabRemoved(tabId: number): void {
    this.buffer.tabRemoved(tabId);
  }

  setEnabled(enabled: boolean): void {
    const first = !this.started;
    this.started = true;
    if (!enabled) {
      this.clears++;
    }
    this.buffer.setEnabled(enabled);
    if (enabled && first) {
      // on the write chain, ahead of every write, so storage never drops the stored reports
      const clearsAtStart = this.clears;
      this.saving = this.saving
        .then(() => this.restore(clearsAtStart))
        .catch((error: unknown) => this.fail(error));
    }
  }

  /** Also stops restoring and writing. An observable a storage failure has errored stays errored. */
  [Symbol.dispose](): void {
    this.stop();
    // a no-op once a storage failure has errored it
    this.resolvedReports.complete();
  }

  private async restore(clearsAtStart: number): Promise<void> {
    if (this.stopped || this.clears !== clearsAtStart) {
      return;
    }
    const record = await this.loaded;
    // `report` would drop an expired report too, but would record its stamp
    for (const report of Object.values(record ?? {})) {
      if (this.now() < report.expiresAt) {
        this.buffer.report(report);
      }
    }
    // what the restore skipped or resolved at once leaves no change behind to write it away
    this.save();
  }

  /**
   * Queues a write of what is buffered when the write runs, so a write waiting its turn covers
   * every change made before it.
   */
  private save(): void {
    if (this.writePending) {
      return;
    }
    this.writePending = true;
    this.saving = this.saving
      .then(() => {
        this.writePending = false;
        if (this.stopped) {
          return;
        }
        const record = Object.fromEntries(this.buffer.buffered);
        return this.state.update(() => record);
      })
      .catch((error: unknown) => this.fail(error));
  }

  private fail(error: unknown): void {
    if (!this.stopped) {
      this.stop();
      this.resolvedReports.error(error);
    }
  }

  private stop(): void {
    this.stopped = true;
    this.subscriptions.unsubscribe();
    this.buffer[Symbol.dispose]();
  }
}

/**
 * Empties the stored buffer. For use after a buffer's stream has errored.
 *
 * @param stateProvider Where the buffer is stored.
 */
export async function resetTransitionBuffer(stateProvider: StateProvider): Promise<void> {
  await stateProvider.getGlobal(BUFFERED_TRANSITIONS).update(() => ({}));
}
