// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, ElementRef, HostListener, OnInit } from "@angular/core";

@Directive({
  selector: "[appBoxRow]",
  standalone: false,
})
export class BoxRowDirective implements OnInit {
  el: HTMLElement = null;
  formEls: Element[];

  constructor(elRef: ElementRef) {
    this.el = elRef.nativeElement;
  }

  ngOnInit(): void {
    this.formEls = Array.from(
      this.el.querySelectorAll('input:not([type="hidden"]), select, textarea'),
    );
    this.formEls.forEach((formEl) => {
      formEl.addEventListener(
        "focus",
        () => {
          this.el.classList.add("active");
        },
        false,
      );

      formEl.addEventListener(
        "blur",
        () => {
          this.el.classList.remove("active");
        },
        false,
      );
    });
  }

  @HostListener("click", ["$event"]) onClick(event: Event) {
    const target = event.target as HTMLElement;
    if (
      target !== this.el &&
      !target.classList.contains("progress") &&
      !target.classList.contains("progress-bar")
    ) {
      return;
    }

    if (this.formEls.length > 0) {
      const formEl = this.formEls[0] as HTMLElement;
      if (formEl.tagName.toLowerCase() === "input") {
        const inputEl = formEl as HTMLInputElement;
        if (inputEl.type != null && inputEl.type.toLowerCase() === "checkbox") {
          inputEl.click();
          return;
        }
      }
      formEl.focus();
    }
  }
}
