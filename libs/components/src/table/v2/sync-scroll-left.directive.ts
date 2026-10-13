import { Directive, ElementRef, effect, inject, model } from "@angular/core";

/**
 * Keeps an element's horizontal scroll position in lockstep with a shared signal,
 * so several scroll containers move together. `<bit-table-v2>` applies it to the
 * header row and the body (the non-virtualized scroll div or the CDK viewport):
 * scrolling any one drives the rest, keeping columns aligned while the header
 * stays pinned vertically.
 *
 * Two-way: writes the element's `scrollLeft` to the model on scroll, and sets
 * `scrollLeft` from the model when another container changes it. Setting
 * `scrollLeft` to its current value emits no scroll event, so the sync converges
 * instead of looping.
 */
@Directive({
  selector: "[bitSyncScrollLeft]",
  host: {
    "(scroll)": "onScroll()",
  },
})
export class SyncScrollLeftDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly scrollLeft = model<number>(0, { alias: "bitSyncScrollLeft" });

  constructor() {
    effect(() => {
      const value = this.scrollLeft();
      if (this.el.nativeElement.scrollLeft !== value) {
        this.el.nativeElement.scrollLeft = value;
      }
    });
  }

  protected onScroll(): void {
    this.scrollLeft.set(this.el.nativeElement.scrollLeft);
  }
}
