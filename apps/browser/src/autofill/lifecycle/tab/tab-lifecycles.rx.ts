import { ignoreElements, Observable, tap } from "rxjs";

import { tabSignals$ } from "./reducer.rx";
import { TabLifecycles } from "./tab-lifecycles";
import type { ReducerSources, TabSignal } from "./types";

/**
 * Feeds {@link TabLifecycles} from the browser's signals. Subscribe to run; it emits nothing.
 *
 * Subscribe to the lifecycles' streams first: they do not replay what they missed, apart from
 * `latestEdges$` and `ready$`.
 */
export function feedTabLifecycles(
  lifecycles: TabLifecycles,
  sources: ReducerSources,
): Observable<never> {
  return tabSignals$(sources).pipe(
    tap<TabSignal>((signal) => lifecycles.apply(signal)),
    ignoreElements(),
  );
}
