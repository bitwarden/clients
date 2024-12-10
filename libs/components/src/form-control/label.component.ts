// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, ElementRef, HostBinding, Input, Optional } from "@angular/core";

import { FormControlComponent } from "./form-control.component";

// Increments for each instance of this component
let nextId = 0;

@Component({
  selector: "bit-label",
  standalone: true,
  templateUrl: "label.component.html",
  imports: [CommonModule],
})
export class BitLabel {
  constructor(
    private elementRef: ElementRef<HTMLInputElement>,
    @Optional() private parentFormControl: FormControlComponent,
  ) {}

  @HostBinding("class") @Input() get classList() {
    return ["tw-inline-flex", "tw-gap-1", "tw-items-baseline", "tw-flex-row", "tw-min-w-0"];
  }

  @HostBinding("title") get title() {
    return this.elementRef.nativeElement.textContent.trim();
  }

  @HostBinding() @Input() id = `bit-label-${nextId++}`;

  get isInsideFormControl() {
    return !!this.parentFormControl;
  }
}
