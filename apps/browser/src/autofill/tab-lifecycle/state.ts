import {
  concatMap,
  defer,
  distinctUntilChanged,
  filter,
  finalize,
  from,
  map,
  merge,
  mergeMap,
  Observable,
  scan,
  take,
  takeUntil,
  tap,
} from "rxjs";

import { anyComplete } from "@bitwarden/common/tools/rx";
import { UserId } from "@bitwarden/common/types/guid";
import { AUTOFILL_TAB_LIFECYCLE_MEMORY, StateProvider, UserKeyDefinition } from "@bitwarden/state";

import { StateSubject } from "../rx";

import type { BufferedTransitionReport, BufferedTransitions } from "./types";

/** One entry per frame: the latest report supersedes. */
export function transitionKey(report: Pick<BufferedTransitionReport, "tabId" | "frameId">): string {
  return `${report.tabId}:${report.frameId ?? -1}`;
}

/**
 * Stored state is input. An entry that is not structurally a `BufferedTransitionReport` is not
 * trusted — the same fail-closed rule `registerTransition` applies at admission.
 */
function isBufferedTransitionReport(value: unknown): value is BufferedTransitionReport {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
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
 * Entries that fail validation are dropped on load, which is why this is not
 * `UserKeyDefinition.record`: that helper deserializes each value and cannot omit one.
 */
export const BUFFERED_TRANSITIONS = new UserKeyDefinition<BufferedTransitions>(
  AUTOFILL_TAB_LIFECYCLE_MEMORY,
  "bufferedTransitions",
  {
    deserializer: (value) => {
      const entries = Object.entries(value ?? {}).filter(([, entry]) =>
        isBufferedTransitionReport(entry),
      );
      return Object.fromEntries(entries) as BufferedTransitions;
    },
    // logout must not leak a paused transition; lock is defined here because no prior behavior is
    // coherent (MV3 discards at unload, MV2 holds indefinitely)
    clearOn: ["lock", "logout"],
  },
);

/** The buffer's stored state for the one user it serves. */
function bufferedTransitions(sources: {
  stateProvider: StateProvider;
  singleUser$: Observable<UserId>;
}): StateSubject<BufferedTransitions> {
  const state$ = sources.singleUser$.pipe(
    distinctUntilChanged(),
    map((userId) => sources.stateProvider.getUser(userId, BUFFERED_TRANSITIONS)),
  );
  return new StateSubject(state$, {});
}

/** Entries past their deadline are never rehydrated, so they are not kept. */
function pruneExpired(record: BufferedTransitions, now: number): BufferedTransitions {
  return Object.fromEntries(Object.entries(record).filter(([, entry]) => now < entry.expiresAt));
}

type FoldEvent =
  | { kind: "set"; report: BufferedTransitionReport }
  | { kind: "delete"; report: BufferedTransitionReport };

/**
 * Mirrors the buffer into storage.
 *
 * Only a resolve must delete: a resolved report left in storage is re-fed at the next restart and
 * fills a second time. A dropped report is omitted absent from the fold by design, and its entry is
 * harmless — a rehydrated report is decided from scratch against the rebuilt machine. Expired
 * entries are pruned as the fold runs.
 *
 * @param sources.stateProvider Where the buffer is stored.
 * @param sources.singleUser$ The user the buffer belongs to. It must not change: a second, different
 * user is an error, and completing it completes the returned stream.
 * @param sources.report$ Reports entering the buffer, including those from {@link rehydrateTransitions$}.
 * @param sources.resolved$ Reports the buffer resolved.
 * @returns The record after each fold step. Cold: subscribe once for the buffer's lifetime or nothing
 * is saved.
 */
export function persistTransitions$(sources: {
  stateProvider: StateProvider;
  singleUser$: Observable<UserId>;
  report$: Observable<BufferedTransitionReport>;
  resolved$: Observable<BufferedTransitionReport>;
  now: () => number;
}): Observable<BufferedTransitions> {
  const { report$, resolved$, now } = sources;

  return defer(() => {
    const store = bufferedTransitions(sources);
    // the stored record replays as soon as it loads
    const loaded$ = store.pipe(take(1));

    return merge(
      report$.pipe(map((report): FoldEvent => ({ kind: "set", report }))),
      resolved$.pipe(map((report): FoldEvent => ({ kind: "delete", report }))),
    ).pipe(
      // An inner join on the load: a left join would fold against an empty map, and the load would
      // then overwrite the result. Each event queues behind the load, in order.
      concatMap((event) => loaded$.pipe(map((loaded) => [event, loaded] as const))),

      // `scan` maintains the runtime buffer; the scan is initialized from `loaded` to prevent
      // events from dropping due to an MV3 restart
      scan((held: BufferedTransitions | undefined, [event, loaded]) => {
        const record = pruneExpired(held ?? loaded, now());
        const key = transitionKey(event.report);
        if (event.kind === "set") {
          return { ...record, [key]: event.report };
        }

        // a resolve deletes only the report it resolved, never a newer one for the same frame
        const stored = record[key];
        if (
          stored?.documentId !== event.report.documentId ||
          stored.stampedAt !== event.report.stampedAt
        ) {
          return record;
        }

        const rest = { ...record };
        delete rest[key];
        return rest;
      }, undefined),

      // persist the latest buffer
      map((record) => record ?? {}),
      tap((record) => store.next(record)),
      takeUntil(anyComplete(store)),
      finalize(() => store.complete()),
    );
  });
}

/**
 * Reads the stored buffer once and emits each report that has not expired, for feeding back into
 * `report$` so restored reports take the same decision path as fresh ones. Completes after one
 * read; it does not delete expired entries from storage.
 *
 * @param sources.stateProvider Where the buffer is stored.
 * @param sources.singleUser$ The user the buffer belongs to. It must not change.
 */
export function rehydrateTransitions$(sources: {
  stateProvider: StateProvider;
  singleUser$: Observable<UserId>;
  now: () => number;
}): Observable<BufferedTransitionReport> {
  const { now } = sources;

  return defer(() => {
    const store = bufferedTransitions(sources);

    return store.pipe(
      take(1),
      mergeMap((record) => from(Object.values(record))),
      filter((report) => now() < report.expiresAt),
      finalize(() => store.complete()),
    );
  });
}
