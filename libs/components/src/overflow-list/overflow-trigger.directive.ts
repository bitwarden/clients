import { Directive, ElementRef, inject, signal } from "@angular/core";

/**
 * Marks an element as the trailing affordance of a parent `[bitOverflowList]` —
 * typically a "More" button that surfaces overflowed items in a menu. The list
 * measures this element and reserves its width from the space available to items,
 * so packing accounts for the affordance instead of overlapping it.
 *
 * The directive hides itself (via `visibility: hidden` + `aria-hidden`) when the
 * list has no overflowed items, while keeping a stable layout width so the list's
 * one-shot width measurement stays accurate. Using `visibility` rather than the
 * `hidden` attribute is what avoids a feedback loop between the trigger's width
 * and the pack decision.
 *
 * Place the trigger as a child of the `[bitOverflowList]` host so the list can
 * find it via `contentChild`.
 */
@Directive({
  selector: "[bitOverflowTrigger]",
  exportAs: "bitOverflowTrigger",
  host: {
    "[style.visibility]": "hasOverflow() ? null : 'hidden'",
    "[attr.aria-hidden]": "hasOverflow() ? null : 'true'",
  },
})
export class OverflowTriggerDirective {
  readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Set by the parent `bitOverflowList` — true when at least one item is overflowed. */
  readonly hasOverflow = signal(false);
}
