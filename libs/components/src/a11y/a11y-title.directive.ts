// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, ElementRef, Input, OnInit } from "@angular/core";

import { setA11yTitleAndAriaLabel } from "./set-a11y-title-and-aria-label";

@Directive({
  selector: "[appA11yTitle]",
})
export class A11yTitleDirective implements OnInit {
  @Input({ required: true }) set appA11yTitle(title: string) {
    this.title = title;
    this.setAttributes();
  }

  private title: string;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit() {
    this.setAttributes();
  }

  private setAttributes() {
    if (this.title) {
      setA11yTitleAndAriaLabel(this.el.nativeElement, this.title);
    }
  }
}
