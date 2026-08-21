import { DestroyRef, ElementRef, Signal, afterNextRender, inject, signal } from "@angular/core";

/**
 * An element to observe, or an accessor for one. Use the accessor form when the
 * element comes from a `viewChild` — those aren't resolved while the calling
 * component's constructor and field initializers run.
 */
export type WidthTarget =
  | HTMLElement
  | ElementRef<HTMLElement>
  | (() => HTMLElement | ElementRef<HTMLElement> | null | undefined);

/**
 * Tracks an element's content-box width, in px, in a signal. Call from an
 * injection context — a constructor or a field initializer.
 *
 * Reads 0 until the first render; consumers treat 0 as "not measured yet". Primed
 * from `clientWidth` at first render so the change-detection pass that follows
 * already has a real width, then tracked via `ResizeObserver`. Stops observing
 * when the calling context is destroyed.
 *
 * The value is the *content* box — padding and border excluded. Observe the
 * element whose content box is the layout budget in question.
 */
export function observedWidth(target: WidthTarget): Signal<number> {
  const width = signal(0);
  const observer = new ResizeObserver((entries) => width.set(entryWidth(entries[0])));

  // Registered eagerly rather than inside `afterNextRender`, so a context
  // destroyed before its first render still tears the observer down.
  inject(DestroyRef).onDestroy(() => observer.disconnect());

  afterNextRender(() => {
    const el = resolveElement(target);
    if (el == null) {
      return;
    }
    width.set(el.clientWidth);
    observer.observe(el);
  });

  return width.asReadonly();
}

function entryWidth(entry: ResizeObserverEntry): number {
  // `contentBoxSize` is the spec'd read; `contentRect` is the older, always-present
  // equivalent, and covers engines that hand back an empty box array.
  return entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width;
}

function resolveElement(target: WidthTarget): HTMLElement | null {
  const resolved = typeof target === "function" ? target() : target;
  if (resolved == null) {
    return null;
  }
  return resolved instanceof ElementRef ? resolved.nativeElement : resolved;
}
