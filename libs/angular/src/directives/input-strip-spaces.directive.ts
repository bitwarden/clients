// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, ElementRef, HostListener, Self } from "@angular/core";
import { NgControl } from "@angular/forms";

@Directive({
  selector: "input[appInputStripSpaces]",
})
export class InputStripSpacesDirective {
  constructor(
    private el: ElementRef<HTMLInputElement>,
    @Self() private ngControl: NgControl,
  ) {}

  @HostListener("input") onInput() {
    const value = this.el.nativeElement.value.replace(/\s+/g, "");
    this.ngControl.control.setValue(value);
  }
}
