import { LiveAnnouncer } from "@angular/cdk/a11y";
import { DestroyRef, inject, Signal } from "@angular/core";
import { toObservable } from "@angular/core/rxjs-interop";
import { debounceTime, distinctUntilChanged, filter, skip } from "rxjs";

/** Long enough that typing a search does not announce every keystroke. */
export const HEALTH_LIST_ANNOUNCE_DEBOUNCE_MS = 500;

/**
 * Politely announces a Health list's count when it changes, for example "2 of 312 groups"
 * after a search. Skips the first value (the page announces itself on arrival) and waits for
 * the count to settle. Clears the live region when the list goes away, so the last count is
 * not left behind on the next page. Call in an injection context.
 *
 * @param count The count to follow; `undefined` while it isn't known yet.
 * @param message The sentence to announce for a count.
 */
export function announceHealthListCount(
  count: Signal<number | undefined>,
  message: (count: number) => string,
): void {
  const liveAnnouncer = inject(LiveAnnouncer);
  const subscription = toObservable(count)
    .pipe(
      filter((value): value is number => value != null),
      distinctUntilChanged(),
      skip(1),
      debounceTime(HEALTH_LIST_ANNOUNCE_DEBOUNCE_MS),
    )
    .subscribe((value) => void liveAnnouncer.announce(message(value), "polite"));

  inject(DestroyRef).onDestroy(() => {
    subscription.unsubscribe();
    // The announcer's live region outlives the page; empty it so "35 of 35 groups" does not
    // linger on the next page for screen readers that browse to it.
    // Optional call: lists built on this helper may stub the announcer with `announce` alone.
    liveAnnouncer.clear?.();
  });
}
