import { Directive, ElementRef, contentChild, inject, input } from "@angular/core";

import { TooltipDirective } from "../tooltip";

/** One row of a multi-select filter menu's tree: its tab stop, its focus, and its label tooltip. */
@Directive({
  selector: "[bitFilterTreeRow]",
  host: {
    "[tabindex]": "tabbable() ? 0 : -1",
    "(focus)": "onFocus()",
    "(blur)": "labelTooltip()?.hideTooltip()",
  },
})
export class FilterTreeRowDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Whether this row holds the tree's single tab stop. */
  readonly tabbable = input(false);

  /** `focusin` only bubbles up, so the row opens its label's tooltip itself. */
  protected readonly labelTooltip = contentChild(TooltipDirective);

  /** Opens on keyboard focus only, as the tooltip does for its own host. */
  protected onFocus(): void {
    if (this.el.nativeElement.matches(":focus-visible")) {
      this.labelTooltip()?.showTooltip();
    }
  }

  focus(): void {
    this.el.nativeElement.focus();
  }

  hasFocus(): boolean {
    return this.el.nativeElement.matches(":focus");
  }
}
