import { DestroyRef, inject, signal, Signal, WritableSignal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import {
  auditTime,
  combineLatest,
  distinctUntilChanged,
  filter,
  finalize,
  fromEvent,
  map,
  switchMap,
} from "rxjs";

import { ScrollLayoutService } from "@bitwarden/components";

/** How often a scrolling list records its offset. */
const RECORD_INTERVAL_MS = 100;

/**
 * A virtual list sizes itself a few frames after its rows arrive, and the table swaps its scroll
 * region once it does. Restoring sooner clamps to 0, so it waits until the offset is reachable.
 */
const RESTORE_RETRY_COUNT = 20;
const RESTORE_RETRY_MS = 16;

/** @returns A function that stops waiting, for when the scroll region is replaced. */
function restoreScroll(element: HTMLElement, top: number, done: () => void): () => void {
  let retriesLeft = RESTORE_RETRY_COUNT;
  let timer: ReturnType<typeof setTimeout>;
  const attempt = () => {
    if (element.scrollHeight - element.clientHeight >= top || retriesLeft-- <= 0) {
      element.scrollTo({ top, behavior: "instant" });
      done();
      return;
    }
    timer = setTimeout(attempt, RESTORE_RETRY_MS);
  };
  timer = setTimeout(attempt);
  return () => clearTimeout(timer);
}

/**
 * Restores a Health list's scroll offset once its rows are on screen, then records the offset
 * as the user scrolls. Follows the page's scroll region (`bit-table-v2 scrollLayoutHost`
 * registers it when its rows render), since the region is not known up front. Call in an
 * injection context; stops with it.
 *
 * @param scrollTop Where to restore to, and where the offset is recorded.
 * @param ready True once the list has its rows; restoring earlier would clamp to 0.
 * @returns True once the saved offset has been restored, or at once when there is none to restore.
 */
export function rememberHealthListScroll(
  scrollTop: WritableSignal<number>,
  ready: Signal<boolean>,
): Signal<boolean> {
  const scrollLayout = inject(ScrollLayoutService);
  const settled = signal(false);
  const target = scrollTop();

  const subscription = combineLatest([scrollLayout.scrollableRef$, toObservable(ready)])
    .pipe(
      filter(([ref, isReady]) => ref?.nativeElement != null && isReady),
      map(([ref]) => ref!.nativeElement),
      distinctUntilChanged(),
      switchMap((element) => {
        let stopRestoring: (() => void) | undefined;
        if (!settled()) {
          if (target > 0) {
            stopRestoring = restoreScroll(element, target, () => settled.set(true));
          } else {
            settled.set(true);
          }
        }
        return fromEvent(element, "scroll").pipe(
          auditTime(RECORD_INTERVAL_MS),
          map(() => element.scrollTop),
          finalize(() => stopRestoring?.()),
        );
      }),
    )
    .subscribe((top) => scrollTop.set(top));

  inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  return settled.asReadonly();
}
