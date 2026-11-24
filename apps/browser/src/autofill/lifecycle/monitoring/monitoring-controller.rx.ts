import { concat, map, merge, mergeMap, Observable, of, take, takeUntil } from "rxjs";

import { MonitoringEventKind } from "./enums";
import type { MonitoringControllerSources, MonitoringEvent } from "./types";

/**
 * The events a `MonitoringController` applies, merged into one stream in the order they arrive. No
 * source has to be ordered against another.
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
        of<MonitoringEvent>({ kind: MonitoringEventKind.PortConnected, port }),
        sources.portDisconnected$(port).pipe(
          take(1),
          map((): MonitoringEvent => ({ kind: MonitoringEventKind.PortDisconnected, port })),
          takeUntil(sources.scriptsReloading$),
        ),
      ),
    ),
  );

  return merge(
    sources.tabLifecycleChanged$.pipe(
      map(([tabId, edge]): MonitoringEvent => ({
        kind: MonitoringEventKind.TabChanged,
        tabId,
        edge,
      })),
    ),
    sources.tabRemoved$.pipe(
      map((tabId): MonitoringEvent => ({ kind: MonitoringEventKind.TabRemoved, tabId })),
    ),
    sources.frameInjected$.pipe(
      map(({ tab, frameId }): MonitoringEvent => ({
        kind: MonitoringEventKind.FrameInjected,
        tab,
        frameId,
      })),
    ),
    ports$,
    sources.scriptsReloading$.pipe(
      map((): MonitoringEvent => ({ kind: MonitoringEventKind.ScriptsReloading })),
    ),
  );
}
