import { CommonModule } from "@angular/common";
import { Component, ElementRef, HostBinding, input, Optional } from "@angular/core";

import { FormControlComponent } from "./form-control.component";

// Increments for each instance of this component
let nextId = 0;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
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
    return this.elementRef.nativeElement.textContent?.trim() ?? "";
  }

  readonly id = input(`bit-label-${nextId++}`);

  get isInsideFormControl() {
    return !!this.parentFormControl;
  }
}
