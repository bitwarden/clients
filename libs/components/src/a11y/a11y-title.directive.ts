import { Directive, effect, ElementRef, input, Renderer2 } from "@angular/core";

@Directive({
  selector: "[appA11yTitle]",
})
export class A11yTitleDirective {
  title = input.required<string>({ alias: "appA11yTitle" });

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {
    const originalTitle = this.el.nativeElement.getAttribute("title");
    const originalAriaLabel = this.el.nativeElement.getAttribute("aria-label");
    effect(() => {
      if (originalTitle === null) {
        this.renderer.setAttribute(this.el.nativeElement, "title", this.title());
      }
      if (originalAriaLabel === null) {
        this.renderer.setAttribute(this.el.nativeElement, "aria-label", this.title());
      }
    });
  }
}
