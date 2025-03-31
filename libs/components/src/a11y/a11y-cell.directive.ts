// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ContentChild, Directive, ElementRef, HostBinding } from "@angular/core";

import { FocusableElement } from "../shared/focusable-element";

@Directive({
  selector: "bitA11yCell",
  standalone: true,
  providers: [{ provide: FocusableElement, useExisting: A11yCellDirective }],
})
export class A11yCellDirective implements FocusableElement {
  @HostBinding("attr.role")
  role: "gridcell" | null;

  @ContentChild(FocusableElement)
  private focusableChild: FocusableElement;

  getFocusTarget() {
    let focusTarget: HTMLElement;
    if (this.focusableChild) {
      focusTarget = this.focusableChild.getFocusTarget();
    } else {
      focusTarget = this.elementRef.nativeElement.querySelector("button, a");
    }

    if (!focusTarget) {
      return this.elementRef.nativeElement;
    }

    return focusTarget;
  }

  constructor(private elementRef: ElementRef<HTMLElement>) {}
}
