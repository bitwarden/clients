import { CdkScrollable } from "@angular/cdk/scrolling";
import { Signal, inject, signal } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { map, startWith, switchMap } from "rxjs";

export type ScrollState = {
  /** `true` when the scrollbar is not at the top-most position */
  top: boolean;

  /** `true` when the scrollbar is not at the bottom-most position */
  bottom: boolean;
};

/**
 * Check if a `CdkScrollable` instance has been scrolled
 * @param scrollable The instance to check, defaults to the one provided by the current injector
 * @returns {Signal<ScrollState>}
 */
export const hasScrolledFrom = (scrollable?: Signal<CdkScrollable>): Signal<ScrollState> => {
  const _scrollable = scrollable ?? signal(inject(CdkScrollable));
  const scrollable$ = toObservable(_scrollable);

  const scrollState$ = scrollable$.pipe(
    switchMap((_scrollable) =>
      _scrollable.elementScrolled().pipe(
        startWith(null),
        map(() => {
          document.body.prepend(`[topOffset:${_scrollable.measureScrollOffset("top")}]`);
          document.body.prepend(`[bottomOffset:${_scrollable.measureScrollOffset("bottom")}]`);

          return {
            top: _scrollable.measureScrollOffset("top") > 0,
            // Using 1 as the threshold here because `_scrollable.measureScrollOffset("bottom")` returns '0.5' at the bottom most position in Chrome
            bottom: _scrollable.measureScrollOffset("bottom") > 1,
          };
        }),
      ),
    ),
  );

  return toSignal(scrollState$, {
    initialValue: {
      top: false,
      bottom: false,
    },
  });
};
