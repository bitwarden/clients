import { Component, inject } from "@angular/core";

import { FormControlModule } from "../form-control/form-control.module";

import { RadioButtonBaseDirective } from "./radio-button-base.directive";
import { RadioInputComponent } from "./radio-input.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-radio-button",
  templateUrl: "radio-button.component.html",
  imports: [FormControlModule, RadioInputComponent],
  host: {
    "[id]": "base.id()",
    class: "[&_bit-hint]:tw-mt-0",
    "[class.tw-block]": "base.block",
    "[class.tw-inline-block]": "!base.block",
  },
  hostDirectives: [
    {
      directive: RadioButtonBaseDirective,
      inputs: ["value", "disabled", "id"],
    },
  ],
})
export class RadioButtonComponent {
  protected base = inject(RadioButtonBaseDirective);

  get selected() {
    return this.base.selected;
  }

  protected onInputChange() {
    this.base.onInputChange();
  }

  protected onBlur() {
    this.base.onBlur();
  }
}
