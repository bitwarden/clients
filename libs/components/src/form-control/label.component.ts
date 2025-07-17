// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, ElementRef, HostBinding, input, Optional } from "@angular/core";

import { FormControlComponent } from "./form-control.component";

// Increments for each instance of this component
let nextId = 0;

@Component({
  selector: "bit-label",
  templateUrl: "label.component.html",
  imports: [CommonModule],
  host: {
    "[class]": "classList",
    "[id]": "id()",
  },
})
export class BitLabel {
  constructor(
    private elementRef: ElementRef<HTMLInputElement>,
    @Optional() private parentFormControl: FormControlComponent,
  ) {}

  readonly classList = [
    "tw-inline-flex",
    "tw-gap-1",
    "tw-items-baseline",
    "tw-flex-row",
    "tw-min-w-0",
  ];

  @HostBinding("title") get title() {
    return this.elementRef.nativeElement.textContent.trim();
  }

  readonly id = input(`bit-label-${nextId++}`);

  get isInsideFormControl() {
    return !!this.parentFormControl;
  }
}
