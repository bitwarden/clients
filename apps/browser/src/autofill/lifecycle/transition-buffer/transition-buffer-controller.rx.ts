import { map, merge, Observable } from "rxjs";

import { PageTransitionEventKind } from "./enums";
import type { BufferedTransitionReport, PageTransitionEvent, PageTransitionSignals } from "./types";

/**
 * The events a `TransitionBufferController` applies, merged into one stream in the order they
 * arrive. The controller finishes each event before it starts the next, so no signal has to be
 * ordered against another.
 *
 * @param maxAgeMs$ How long a transition stays actionable. Its values are events too, because a
 * report cannot be stamped until the age is known.
 * @param restored$ The transitions the buffer restored from storage. They are events too, because
 * their tabs decide what they deserve.
 */
export function pageTransitionEvents$(
  signals: PageTransitionSignals,
  maxAgeMs$: Observable<number>,
  restored$: Observable<BufferedTransitionReport>,
): Observable<PageTransitionEvent> {
  return merge(
    maxAgeMs$.pipe(
      map((ms): PageTransitionEvent => ({ kind: PageTransitionEventKind.MaxAge, ms })),
    ),
    signals.accountEvents$.pipe(
      map((event): PageTransitionEvent => ({ kind: PageTransitionEventKind.Account, event })),
    ),
    signals.report$.pipe(
      map((report): PageTransitionEvent => ({ kind: PageTransitionEventKind.Report, report })),
    ),
    signals.tabLifecycleChanged$.pipe(
      map(([tabId, edge]): PageTransitionEvent => ({
        kind: PageTransitionEventKind.TabChanged,
        tabId,
        edge,
      })),
    ),
    signals.tabRemoved$.pipe(
      map((tabId): PageTransitionEvent => ({ kind: PageTransitionEventKind.TabRemoved, tabId })),
    ),
    signals.frameLost$.pipe(
      map(({ tabId, frameId }): PageTransitionEvent => ({
        kind: PageTransitionEventKind.FrameLost,
        tabId,
        frameId,
      })),
    ),
    signals.scriptsReloading$.pipe(
      map((): PageTransitionEvent => ({ kind: PageTransitionEventKind.ScriptsReloading })),
    ),
    restored$.pipe(
      map((report): PageTransitionEvent => ({ kind: PageTransitionEventKind.Restored, report })),
    ),
  );
}
