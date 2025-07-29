// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, ElementRef, Input, OnInit, Renderer2 } from "@angular/core";

import { setA11yTitleAndAriaLabel } from "./set-a11y-title-and-aria-label";
@Directive({
  selector: "[appA11yTitle]",
})
export class A11yTitleDirective implements OnInit {
  // TODO: Skipped for signal migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
  @Input() set appA11yTitle(title: string) {
    this.title = title;
    this.setAttributes();
  }

  private title: string;
  private originalTitle: string | null;
  private originalAriaLabel: string | null;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {}

  ngOnInit() {
    this.originalTitle = this.el.nativeElement.getAttribute("title");
    this.originalAriaLabel = this.el.nativeElement.getAttribute("aria-label");

    this.setAttributes();
  }

  private setAttributes() {
    setA11yTitleAndAriaLabel({
      element: this.el.nativeElement,
      title: this.originalTitle ?? this.title,
      label: this.originalAriaLabel ?? this.title,
    });
  }
}
