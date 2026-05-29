import { Directive, ElementRef, inject, model, signal } from "@angular/core";

/**
 * Marks an element as an item managed by a parent `[bitOverflowList]`. The list
 * measures these items and decides which fit in the visible row; items that don't
 * fit are hidden via the `hidden` attribute and surfaced through the list's
 * `overflow` signal so the consumer can render them elsewhere (typically a menu).
 *
 * Setting `[pinned]="true"` tells the list to keep this item visible even when it
 * would otherwise overflow — useful when one item is "load-bearing" for the user
 * (a selected tab, a primary action, etc.) and the consumer decides which one.
 */
@Directive({
  selector: "[bitOverflowItem]",
  exportAs: "bitOverflowItem",
})
export class OverflowItemDirective {
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * When true, the list keeps this item visible regardless of available space.
   * If more than one item is pinned, the first one wins; the rest pack normally.
   */
  readonly pinned = model(false);

  /**
   * Set by the parent `bitOverflowList` — true when this is the only displayed item
   * alongside overflowed items. Consumers gate truncation/shrink styling on this so
   * the lone fitting item only gets `flex-shrink` permission *after* JS has decided
   * to hide its siblings, avoiding CSS shrinking it before they get hidden.
   */
  readonly shouldShrink = signal(false);
}
