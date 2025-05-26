import { Directionality } from "@angular/cdk/bidi";
import { CdkVirtualScrollable, ScrollDispatcher, VIRTUAL_SCROLLABLE } from "@angular/cdk/scrolling";
import { Directive, ElementRef, NgZone, Optional } from "@angular/core";

@Directive({
  selector: "[bitScrollLayout]",
  standalone: true,
  providers: [{ provide: VIRTUAL_SCROLLABLE, useExisting: ScrollLayoutDirective }],
})
export class ScrollLayoutDirective extends CdkVirtualScrollable {
  private scrollableRef: ElementRef<HTMLElement>;

  constructor(scrollDispatcher: ScrollDispatcher, ngZone: NgZone, @Optional() dir: Directionality) {
    const scrollableEl = document.querySelector<HTMLElement>(
      ".bit-virtual-scrollable.cdk-virtual-scrollable",
    )!;
    if (!scrollableEl) {
      // eslint-disable-next-line no-console
      console.error(
        "Element with `.bit-virtual-scrollable.cdk-virtual-scrollable` must be an ancestor of [bitScrollLayout]",
      );
    }
    const scrollableRef = new ElementRef(scrollableEl);
    super(scrollableRef, scrollDispatcher, ngZone, dir);
    this.scrollableRef = scrollableRef;
  }

  override getElementRef(): ElementRef<HTMLElement> {
    return this.scrollableRef;
  }

  override measureBoundingClientRectWithScrollOffset(
    from: "left" | "top" | "right" | "bottom",
  ): number {
    return (
      this.scrollableRef.nativeElement.getBoundingClientRect()[from] -
      this.measureScrollOffset(from)
    );
  }
}
