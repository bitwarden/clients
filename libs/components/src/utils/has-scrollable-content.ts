import { DestroyRef, WritableSignal } from "@angular/core";
import { Observable, merge, animationFrameScheduler } from "rxjs";
import { auditTime, map, startWith, observeOn, distinctUntilChanged } from "rxjs/operators";

/** IntersectionObserver → Observable */
function intersection$(
  target: Element,
  init: IntersectionObserverInit,
): Observable<IntersectionObserverEntry> {
  return new Observable((sub) => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        sub.next(e);
      }
    }, init);
    io.observe(target);
    return () => io.disconnect();
  });
}

/** ResizeObserver → Observable */
function resize$(...els: Element[]): Observable<void> {
  return new Observable((sub) => {
    const ro = new ResizeObserver(() => sub.next());
    els.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  });
}

export interface HasScrollableContentOptions {
  threshold?: number; // default: 1 (fully visible)
  destroyRef?: DestroyRef; // optional auto-teardown
}

/** Emits whenever scroll/resize/layout might change visibility */
const scrollableContentObservable$ = (
  root: HTMLElement,
  target: HTMLElement,
  threshold: HasScrollableContentOptions["threshold"] = 1,
): Observable<boolean> => {
  const intersectionObserver$ = intersection$(target, { root, threshold });
  const resizeObserver$ = resize$(root, target);

  return merge(intersectionObserver$, resizeObserver$).pipe(
    startWith(null as IntersectionObserverEntry | null),
    auditTime(0, animationFrameScheduler),
    observeOn(animationFrameScheduler),
    map((entry: IntersectionObserverEntry | null) => {
      if (!entry) {
        return root.scrollHeight > root.clientHeight;
      }
      return !entry.isIntersecting;
    }),
    distinctUntilChanged(),
  );
};

type HasScrollableContentConfig = {
  root: HTMLElement;
  target: HTMLElement;
  boundValue: BoundValue;
  options?: {
    threshold?: number; // default: 1 (fully visible)
    destroyRef?: DestroyRef; // optional auto-teardown},
  };
};

type BoundValue = ((v: boolean) => void) | WritableSignal<boolean>;

/**
 *  Utility to determine if an element has scrollable content.
 *
 * NOTE: If not passing a destroyRef in the 'options' object, you must call the returned `unsubscribe` function to clean up the observers
 */
export const hasScrollableContent = ({
  root,
  target,
  boundValue,
  options = {},
}: HasScrollableContentConfig): { unsubscribe: () => void } => {
  const { threshold = 1, destroyRef } = options;

  const stream$ = scrollableContentObservable$(root, target, threshold);

  const setBoundValue = (isScrollable: boolean) => {
    if (typeof (boundValue as unknown as any)?.set === "function") {
      // WritableSignal<boolean>
      (boundValue as WritableSignal<boolean>).set(isScrollable);
    } else {
      (boundValue as (isScrollable: boolean) => void)(isScrollable);
    }
  };

  const subscription = stream$.subscribe((isScrollable: boolean) => {
    setBoundValue(isScrollable);
  });

  const unsubscribe = () => subscription.unsubscribe();
  destroyRef?.onDestroy(unsubscribe);

  return { unsubscribe };
};
