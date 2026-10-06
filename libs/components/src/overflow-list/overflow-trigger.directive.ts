import { booleanAttribute, Directive, ElementRef, inject, input } from "@angular/core";

/**
 * Marks an element as the trailing affordance of a parent `[bitOverflowList]` —
 * typically a "More" button that surfaces overflowed items in a menu. The list
 * measures this element and reserves its width from the space available to items,
 * so packing accounts for the affordance instead of overlapping it. The list also
 * toggles the trigger's `hidden` property to mirror whether anything has actually
 * overflowed — the trigger is rendered (and measured) on the first pass, then
 * hidden if no items overflow.
 *
 * Place the trigger as a child of the `[bitOverflowList]` host so the list can
 * find it via `contentChild`.
 */
@Directive({
  selector: "[bitOverflowTrigger]",
  exportAs: "bitOverflowTrigger",
})
export class OverflowTriggerDirective {
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * When true, the parent list keeps the trigger visible even when nothing has
   * overflowed. Use this when the trigger opens a menu that has other content
   * (e.g., always-present "additional actions") so it shouldn't disappear just
   * because the overflow set happens to be empty.
   */
  readonly alwaysShow = input(false, { transform: booleanAttribute });
}
