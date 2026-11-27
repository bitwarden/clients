import { DestroyRef, inject, Signal, WritableSignal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import {
  auditTime,
  combineLatest,
  distinctUntilChanged,
  filter,
  fromEvent,
  map,
  switchMap,
} from "rxjs";

import { ScrollLayoutService } from "@bitwarden/components";

/** How often a scrolling list records its offset. */
const RECORD_INTERVAL_MS = 100;

/**
 * Restores a Health list's scroll offset once its rows are on screen, then records the offset
 * as the user scrolls. Follows the page's scroll region (`bit-table-v2 scrollLayoutHost`
 * registers it when its rows render), since the region is not known up front. Call in an
 * injection context; stops with it.
 *
 * @param scrollTop Where to restore to, and where the offset is recorded.
 * @param ready True once the list has its rows; restoring earlier would clamp to 0.
 */
export function rememberHealthListScroll(
  scrollTop: WritableSignal<number>,
  ready: Signal<boolean>,
): void {
  const scrollLayout = inject(ScrollLayoutService);
  let restored = false;

  const subscription = combineLatest([scrollLayout.scrollableRef$, toObservable(ready)])
    .pipe(
      filter(([ref, isReady]) => ref?.nativeElement != null && isReady),
      map(([ref]) => ref!.nativeElement),
      distinctUntilChanged(),
      switchMap((element) => {
        if (!restored) {
          restored = true;
          const target = scrollTop();
          if (target > 0) {
            // After this render, so the virtual rows exist to scroll through.
            setTimeout(() => element.scrollTo({ top: target, behavior: "instant" }));
          }
        }
        return fromEvent(element, "scroll").pipe(
          auditTime(RECORD_INTERVAL_MS),
          map(() => element.scrollTop),
        );
      }),
    )
    .subscribe((top) => scrollTop.set(top));

  inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
}
