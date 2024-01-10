import { Directive, ElementRef, Input, OnInit, Renderer2 } from "@angular/core";

@Directive({
  selector: "[appA11yTitle]",
})
export class A11yTitleDirective implements OnInit {
  @Input() set appA11yTitle(title: string) {
    this.title = title;
  }

  private title: string;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {}

  ngOnInit() {
    if (!this.el.nativeElement.hasAttribute("title")) {
      this.renderer.setAttribute(this.el.nativeElement, "title", this.title);
    }
    if (!this.el.nativeElement.hasAttribute("aria-label")) {
      this.renderer.setAttribute(this.el.nativeElement, "aria-label", this.title);
    }
  }
}
