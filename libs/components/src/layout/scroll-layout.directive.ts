import { Directionality } from "@angular/cdk/bidi";
import { CdkVirtualScrollable, ScrollDispatcher, VIRTUAL_SCROLLABLE } from "@angular/cdk/scrolling";
import { Directive, ElementRef, NgZone, Optional } from "@angular/core";

@Directive({
  selector: "cdk-virtual-scroll-viewport[bitScrollLayout]",
  standalone: true,
  providers: [{ provide: VIRTUAL_SCROLLABLE, useExisting: ScrollLayoutDirective }],
})
export class ScrollLayoutDirective extends CdkVirtualScrollable {
  private mainRef: ElementRef<HTMLElement>;

  constructor(scrollDispatcher: ScrollDispatcher, ngZone: NgZone, @Optional() dir: Directionality) {
    const mainEl = document.querySelector("main")!;
    if (!mainEl) {
      // eslint-disable-next-line no-console
      console.error("HTML main element must be an ancestor of [bitScrollLayout]");
    }
    const mainRef = new ElementRef(mainEl);
    super(mainRef, scrollDispatcher, ngZone, dir);
    this.mainRef = mainRef;
  }

  override getElementRef(): ElementRef<HTMLElement> {
    return this.mainRef;
  }

  override measureBoundingClientRectWithScrollOffset(
    from: "left" | "top" | "right" | "bottom",
  ): number {
    return (
      this.mainRef.nativeElement.getBoundingClientRect()[from] - this.measureScrollOffset(from)
    );
  }
}
