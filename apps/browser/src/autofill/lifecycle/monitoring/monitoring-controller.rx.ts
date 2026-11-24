import { concat, map, merge, mergeMap, Observable, of, take, takeUntil } from "rxjs";

import type { MonitoringControllerSources, MonitoringEvent } from "./types";

/**
 * The events a `MonitoringController` applies, merged into one stream in the order they arrive. No
 * source has to be ordered against another. Listeners of the controller must not emit to the
 * sources while an event is being applied.
 *
 * Each port's `portDisconnected` event follows its `portConnected` event and occurs at most once.
 * A port that was connected when the scripts began reloading reports no disconnect.
 */
export function monitoringEvents$(
  sources: MonitoringControllerSources,
): Observable<MonitoringEvent> {
  const ports$ = sources.portConnected$.pipe(
    mergeMap((port) =>
      concat(
        of<MonitoringEvent>({ kind: "portConnected", port }),
        sources.portDisconnected$(port).pipe(
          take(1),
          map((): MonitoringEvent => ({ kind: "portDisconnected", port })),
          takeUntil(sources.scriptsReloading$),
        ),
      ),
    ),
  );

  return merge(
    sources.tabLifecycleChanged$.pipe(
      map(([tabId, edge]): MonitoringEvent => ({ kind: "tabChanged", tabId, edge })),
    ),
    sources.tabRemoved$.pipe(map((tabId): MonitoringEvent => ({ kind: "tabRemoved", tabId }))),
    sources.frameInjected$.pipe(
      map(({ tab, frameId }): MonitoringEvent => ({ kind: "frameInjected", tab, frameId })),
    ),
    ports$,
    sources.scriptsReloading$.pipe(map((): MonitoringEvent => ({ kind: "scriptsReloading" }))),
  );
}
