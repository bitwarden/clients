import { Directive, inject } from "@angular/core";

import { PopoverAnchorForDirective } from "./popover-anchor-for.directive";

/**
 * Directive that creates an interactive trigger for a popover.
 * Opens on click and sets appropriate ARIA attributes.
 * Composes `bitPopoverAnchor` for positioning and overlay management.
 *
 * @example
 * ```html
 * <button [bitPopoverTriggerFor]="helpPopover">
 *   <i class="bwi bwi-question-circle"></i>
 * </button>
 * <bit-popover #helpPopover [title]="'Help'">
 *   Help content here
 * </bit-popover>
 * ```
 */
@Directive({
  selector: "[bitPopoverTriggerFor]",
  exportAs: "popoverTrigger",
  hostDirectives: [
    {
      directive: PopoverAnchorForDirective,
      inputs: ["bitPopoverAnchorFor: bitPopoverTriggerFor", "position", "popoverOpen"],
      outputs: ["popoverOpenChange"],
    },
  ],
  host: {
    "[attr.aria-expanded]": "this.anchor.popoverOpen()",
    "(click)": "togglePopover()",
  },
})
export class PopoverTriggerForDirective {
  /** The composed anchor directive that handles overlay positioning */
  protected readonly anchor = inject(PopoverAnchorForDirective);

  /** Exposes popoverOpen for programmatic access via `exportAs="popoverTrigger"` */
  get popoverOpen() {
    return this.anchor.popoverOpen;
  }

  /** Toggles popover visibility on click */
  protected togglePopover() {
    if (this.anchor.popoverOpen()) {
      this.anchor.closePopover();
    } else {
      this.anchor.openPopover();
    }
  }

  /** Programmatically closes the popover */
  closePopover() {
    this.anchor.closePopover();
  }
}
