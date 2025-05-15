// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, ElementRef, Input, OnInit, Renderer2 } from "@angular/core";

@Directive({
  selector: "[appInputVerbatim]",
  standalone: false,
})
export class InputVerbatimDirective implements OnInit {
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
      this.renderer.setAttribute(this.el.nativeElement, "autocapitalize", "none");
    }
    if (!this.el.nativeElement.hasAttribute("autocorrect")) {
      this.renderer.setAttribute(this.el.nativeElement, "autocorrect", "none");
    }
    if (!this.el.nativeElement.hasAttribute("spellcheck")) {
      this.renderer.setAttribute(this.el.nativeElement, "spellcheck", "false");
    }
    if (!this.el.nativeElement.hasAttribute("inputmode")) {
      this.renderer.setAttribute(this.el.nativeElement, "inputmode", "verbatim");
    }
  }
}
