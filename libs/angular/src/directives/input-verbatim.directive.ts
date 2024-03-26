import { Directive, ElementRef, Input, Renderer2 } from "@angular/core";

@Directive({
  selector: "[appInputVerbatim]",
})
export class InputVerbatimDirective {
  @Input() set appInputVerbatim(condition: boolean | string) {
    this.disableComplete = condition === "" || condition === true;
  }

  private disableComplete: boolean;

  constructor(
    private el: ElementRef,
    private renderer: Renderer2,
  ) {}

  ngOnInit() {
    if (this.disableComplete && !this.el.nativeElement.hasAttribute("autocomplete")) {
      this.renderer.setAttribute(this.el.nativeElement, "autocomplete", "off");
    }
    if (!this.el.nativeElement.hasAttribute("autocapitalize")) {
      this.renderer.setAttribute(this.el.nativeElement, "autocapitalize", "off");
    }
    if (!this.el.nativeElement.hasAttribute("autocorrect")) {
      this.renderer.setAttribute(this.el.nativeElement, "autocorrect", "off");
    }
    if (!this.el.nativeElement.hasAttribute("spellcheck")) {
      this.renderer.setAttribute(this.el.nativeElement, "spellcheck", "false");
    }
    if (!this.el.nativeElement.hasAttribute("inputmode")) {
      this.renderer.setAttribute(this.el.nativeElement, "inputmode", "verbatim");
    }
  }
}
