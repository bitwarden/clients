// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, ElementRef, input, OnInit } from "@angular/core";

@Directive({
  selector: "[appA11yTitle]",
  host: {
    "[attr.title]": "this.getTitleAttr()",
    "[attr.aria-label]": "this.getAriaLabelAttr()",
  },
})
export class A11yTitleDirective implements OnInit {
  appA11yTitle = input<string>();

  private originalTitle: string | null;
  private originalAriaLabel: string | null;

  constructor(private el: ElementRef) {}

  ngOnInit() {
    this.originalTitle = this.el.nativeElement.getAttribute("title");
    this.originalAriaLabel = this.el.nativeElement.getAttribute("aria-label");
  }

  getTitleAttr() {
    return this.originalTitle ?? this.appA11yTitle();
  }

  getAriaLabelAttr() {
    return this.originalAriaLabel ?? this.appA11yTitle();
  }
}
