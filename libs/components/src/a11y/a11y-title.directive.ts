import { Directive, ElementRef, input, OnInit, Renderer2 } from "@angular/core";

@Directive({
  selector: "[appA11yTitle]",
})
export class A11yTitleDirective implements OnInit {
  title = input.required<string>({ alias: "appA11yTitle" });

  private originalTitle: string | null = null;
  private originalAriaLabel: string | null = null;

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
    if (this.originalTitle === null) {
      this.renderer.setAttribute(this.el.nativeElement, "title", this.title());
    }
    if (this.originalAriaLabel === null) {
      this.renderer.setAttribute(this.el.nativeElement, "aria-label", this.title());
    }
  }
}
