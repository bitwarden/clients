import { Directive, effect, ElementRef, input } from "@angular/core";

import { setA11yTitleAndAriaLabel } from "./set-a11y-title-and-aria-label";

@Directive({
  selector: "[appA11yTitle]",
})
export class A11yTitleDirective {
  title = input.required<string>({ alias: "appA11yTitle" });

  constructor(private el: ElementRef) {
    const originalTitle = this.el.nativeElement.getAttribute("title");
    const originalAriaLabel = this.el.nativeElement.getAttribute("aria-label");

    effect(() => {
      setA11yTitleAndAriaLabel({
        element: this.el.nativeElement,
        title: originalTitle ?? this.title(),
        label: originalAriaLabel ?? this.title(),
      });
    });
  }
}
