import {
  concat,
  filter,
  groupBy,
  map,
  mergeMap,
  Observable,
  share,
  of,
  switchMap,
  take,
  takeUntil,
  takeWhile,
  withLatestFrom,
} from "rxjs";

import { latestByKey } from "../rx";

import { TransitionValidity } from "./enums";
import type {
  BufferAction,
  BufferedTransitionReport,
  LiveFrame,
  TabEdge,
  TransitionReport,
} from "./types";
import { edgeBufferAction, reportBufferAction } from "./utils";

/**
 * Admits a reported transition to the buffer.
 *
 * Admission fails closed: a report that cannot be targeted (no `tabId`) or cannot be validated
 * later (no `documentId`, or an empty one) is rejected.
 *
 * @param report The browser-supplied facts of the transition.
 * @param options.now Epoch ms of admission.
 * @param options.maxAgeMs How long the report stays actionable.
 * @returns The stamped report, or `undefined` if it cannot be admitted.
 */
export function registerTransition(
  report: TransitionReport,
  options: { now: number; maxAgeMs: number },
): BufferedTransitionReport | undefined {
  const { tabId, frameId, documentId } = report;
  if (tabId === undefined || !documentId) {
    return undefined;
  }

  return {
    tabId,
    frameId,
    documentId,
    stampedAt: options.now,
    expiresAt: options.now + options.maxAgeMs,
  };
}

/**
 * Whether a held transition may still be acted on. It answers that question and nothing else; it
 * does not select a cipher or decide that a fill is appropriate.
 *
 * @param report The held transition.
 * @param live The frame as the browser reports it now, or `undefined` if the frame is gone.
 * @param now Epoch ms.
 */
export function validateTransition(
  report: BufferedTransitionReport,
  live: LiveFrame | undefined,
  now: number,
): TransitionValidity {
  // expiry first, so an expired report is never validated against a live frame
  if (now >= report.expiresAt) {
    return TransitionValidity.Expired;
  }
  if (live === undefined) {
    return TransitionValidity.FrameGone;
  }
  if (live.documentId === undefined) {
    return TransitionValidity.Unverifiable;
  }
  if (live.documentId !== report.documentId) {
    return TransitionValidity.DocumentChanged;
  }
  return TransitionValidity.Valid;
}

/** What `bufferTransitionReports$` and `awaitResolution$` read. */
export type BufferSources = {
  /** Reports admitted by `registerTransition`, and those from `rehydrateTransitions$`. */
  report$: Observable<BufferedTransitionReport>;
  /** Each state change the lifecycle machine reports, with the id of the browser tab it belongs to. */
  tabLifecycleChanged$: Observable<readonly [tabId: number, edge: TabEdge]>;
  /** Emits when the frame no longer exists. Independent of tab state and of monitoring. */
  frameLost$: (tabId: number, frameId: number | undefined) => Observable<void>;
  /** Emits the id of each browser tab that is removed. */
  tabRemoved$: Observable<number>;
  now: () => number;
};

/** What `awaitResolution$` reads: one tab's lifecycle changes, in place of every tab's. */
export type ResolutionSources = Pick<BufferSources, "frameLost$" | "now"> & {
  lifecycleChanged$: (tabId: number) => Observable<TabEdge>;
};

/**
 * One report's wait. Emits the report if and when its tab resolves it; completes silently if it is
 * dropped, expires, or its frame is lost. Adds no errors of its own.
 *
 * Expiry is checked wherever a decision is already being made and no timer is scheduled, so an
 * expired report that sees no further lifecycle change stays subscribed until its frame is lost or its tab is
 * removed.
 *
 * @param entry The report, paired with the action decided for it when it arrived.
 * @param sources The lifecycle, frame-loss and clock inputs.
 */
export function awaitResolution$(
  [report, reportTimeAction]: readonly [BufferedTransitionReport, BufferAction],
  sources: ResolutionSources,
): Observable<BufferedTransitionReport> {
  return concat(
    of(reportTimeAction),
    sources.lifecycleChanged$(report.tabId).pipe(map(edgeBufferAction)),
  ).pipe(
    // an expired report is a drop, evaluated wherever a decision is already being made
    map((action) => (sources.now() < report.expiresAt ? action : "drop")),
    takeWhile((action) => action !== "drop"),
    filter((action) => action === "resolve"),
    take(1),
    map(() => report),
    takeUntil(sources.frameLost$(report.tabId, report.frameId)),
  );
}

/**
 * Holds each reported transition until its tab resolves it. A report for a frame supersedes the
 * previous one for that frame. A dropped report emits nothing.
 *
 * @returns The reports that resolved into a fill opportunity. Resolution does not check that the
 * document is still live; call {@link validateTransition} before acting.
 */
export function bufferTransitionReports$(
  sources: BufferSources,
): Observable<BufferedTransitionReport> {
  const { report$ } = sources;
  // each is read once for the report-time join and again for every waiting report, so they are
  // multicast here rather than left to the caller
  const tabLifecycleChanged$ = sources.tabLifecycleChanged$.pipe(share());
  const tabRemoved$ = sources.tabRemoved$.pipe(share());
  const lifecycleChanged$ = (tabId: number) =>
    tabLifecycleChanged$.pipe(
      filter(([id]) => id === tabId),
      map(([, change]) => change),
    );
  const latestLifecycle$ = tabLifecycleChanged$.pipe(latestByKey(tabRemoved$));

  return report$.pipe(
    withLatestFrom(latestLifecycle$),
    map(([report, latest]) => [report, reportBufferAction(latest.get(report.tabId))] as const),

    groupBy(([report]) => report.tabId),
    mergeMap((tab$) =>
      tab$.pipe(
        groupBy(([report]) => report.frameId ?? -1),
        // a fresh report for a frame unsubscribes the one before it: latest-per-frame
        mergeMap((frame$) =>
          frame$.pipe(
            switchMap((entry) => awaitResolution$(entry, { ...sources, lifecycleChanged$ })),
          ),
        ),
        // groups never complete while their source stays open; tab removal releases them
        takeUntil(tabRemoved$.pipe(filter((tabId) => tabId === tab$.key))),
      ),
    ),
  );
}
