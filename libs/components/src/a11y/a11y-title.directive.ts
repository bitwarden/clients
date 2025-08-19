import { Directive, ElementRef, input, OnInit } from "@angular/core";

import { setA11yTitleAndAriaLabel } from "./set-a11y-title-and-aria-label";
@Directive({
  selector: "[appA11yTitle]",
})
export class A11yTitleDirective implements OnInit {
  title = input.required<string>({ alias: "appA11yTitle" });

  private originalTitle: string | null;
  private originalAriaLabel: string | null;

  constructor(private el: ElementRef) {}

  ngOnInit() {
    this.originalTitle = this.el.nativeElement.getAttribute("title");
    this.originalAriaLabel = this.el.nativeElement.getAttribute("aria-label");

    this.setAttributes();
  }

  private setAttributes() {
    setA11yTitleAndAriaLabel({
      element: this.el.nativeElement,
      title: this.originalTitle ?? this.title(),
      label: this.originalAriaLabel ?? this.title(),
    });
  }
}
