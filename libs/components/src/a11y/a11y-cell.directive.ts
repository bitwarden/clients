import { Directive, ElementRef, HostBinding, contentChild } from "@angular/core";

import { FocusableElement } from "../shared/focusable-element";

@Directive({
  selector: "[bitA11yCell]",
  standalone: true,
  providers: [{ provide: FocusableElement, useExisting: A11yCellDirective }],
})
export class A11yCellDirective implements FocusableElement {
  @HostBinding("attr.role")
  role?: "gridcell" | null;

  private focusableChild = contentChild(FocusableElement);

  getFocusTarget() {
    let focusTarget: HTMLElement | undefined | null;
    const focusableChild = this.focusableChild();
    if (focusableChild) {
      focusTarget = focusableChild.getFocusTarget();
    } else {
      focusTarget = this.elementRef.nativeElement.querySelector<HTMLElement>("button, a");
    }

    if (!focusTarget) {
      return this.elementRef.nativeElement;
    }

    return focusTarget;
  }

  constructor(private elementRef: ElementRef<HTMLElement>) {}
}
