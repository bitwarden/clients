import { ElementRef, Signal } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { animationFrameScheduler, fromEvent, of } from "rxjs";
import { auditTime, distinctUntilChanged, map, scan, startWith, switchMap } from "rxjs/operators";

/** Which way the user is currently moving through a scrollable region. */
export type ScrollDirection = "up" | "down";

export type ScrollDirectionOptions = {
  /**
   * Pixels of travel required to flip direction. Filters out the sub-pixel and trackpad jitter that
   * would otherwise make the reported direction thrash.
   */
  threshold?: number;

  /** Within this many pixels of the top, always report `"up"`. */
  topOffset?: number;

  /**
   * Within this many pixels of the bottom, hold `"down"`. Prevents an oscillation loop when a
   * consumer collapses chrome in response to `"down"`: the collapse grows the viewport, the browser
   * clamps `scrollTop`, and the smaller offset would otherwise read as `"up"`.
   */
  bottomOffset?: number;

  /**
   * How far the region must be able to scroll before `"down"` is reported at all.
   *
   * Without a floor here, a consumer that collapses chrome on `"down"` can get stuck in a loop: the
   * collapse gives that height back to the scroll region, and if there wasn't much to scroll to
   * begin with, the browser snaps back to the top — which reads as `"up"`, reopens the chrome, and
   * leaves the next scroll to start the loop over.
   *
   * Pass the height of the chrome being collapsed. Use a callback to measure it live — it is only
   * read while scrolling `"up"`, when that chrome is expanded.
   */
  minScrollable?: number | (() => number);
};

type ScrollDirectionState = {
  direction: ScrollDirection;

  /** The offset at which the current direction was committed. */
  anchor: number;
};

const initialState: ScrollDirectionState = { direction: "up", anchor: 0 };

const nativeElement = (
  scrollable: ElementRef<HTMLElement> | HTMLElement | null | undefined,
): HTMLElement | null => {
  if (scrollable instanceof ElementRef) {
    return scrollable.nativeElement;
  }

  return scrollable ?? null;
};

/**
 * Track the direction a scrollable element is being scrolled.
 *
 * Takes an element rather than a `CdkScrollable` so that it also works with regions marked by
 * `bitScrollLayoutHost`, which is not a `CdkScrollable`.
 *
 * @param scrollable The element to observe. Reports `"up"` while it is nullish or not scrollable.
 * @param options See {@link ScrollDirectionOptions}
 * @returns {Signal<ScrollDirection>} `"up"` until the element is scrolled down.
 */
export const scrollDirection = (
  scrollable: Signal<ElementRef<HTMLElement> | HTMLElement | null | undefined>,
  {
    threshold = 16,
    topOffset = 0,
    bottomOffset = 24,
    minScrollable = 0,
  }: ScrollDirectionOptions = {},
): Signal<ScrollDirection> => {
  const readMinScrollable =
    typeof minScrollable === "function" ? minScrollable : () => minScrollable;

  const element$ = toObservable(scrollable).pipe(map(nativeElement));

  const direction$ = element$.pipe(
    switchMap((element) => {
      if (!element) {
        return of<ScrollDirection>("up");
      }

      return fromEvent(element, "scroll").pipe(
        auditTime(0, animationFrameScheduler),
        startWith(null),
        map(() => ({
          top: element.scrollTop,
          maxTop: element.scrollHeight - element.clientHeight,
          viewport: element.clientHeight,
        })),
        scan((state: ScrollDirectionState, { top, maxTop, viewport }): ScrollDirectionState => {
          if (maxTop <= 0 || top <= topOffset) {
            return { direction: "up", anchor: top };
          }

          // Gates the flip only. Once `"down"`, the collapsed chrome has legitimately reduced
          // `maxTop`, and re-testing it here would expand the chrome again. Equality still fails:
          // giving back exactly `maxTop` leaves nothing to scroll.
          if (state.direction === "up" && maxTop <= readMinScrollable()) {
            return { direction: "up", anchor: top };
          }

          if (top >= maxTop - bottomOffset) {
            return { direction: "down", anchor: top };
          }

          const delta = top - state.anchor;

          // A viewport-sized jump is programmatic — a scroll position restore, `scrollIntoView`,
          // or the browser clamping the offset. Re-anchor without reading it as user intent.
          if (Math.abs(delta) >= viewport) {
            return { direction: state.direction, anchor: top };
          }

          if (Math.abs(delta) <= threshold) {
            // Track the extreme so that jitter can't accumulate into a flip.
            const anchor =
              state.direction === "down"
                ? Math.max(state.anchor, top)
                : Math.min(state.anchor, top);

            return { direction: state.direction, anchor };
          }

          return { direction: delta > 0 ? "down" : "up", anchor: top };
        }, initialState),
        map(({ direction }) => direction),
      );
    }),
    distinctUntilChanged(),
  );

  return toSignal(direction$, { initialValue: "up" });
};
