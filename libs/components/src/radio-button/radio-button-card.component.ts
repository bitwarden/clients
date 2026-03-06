import { Component, HostBinding, inject } from "@angular/core";

import { FormControlCardComponent } from "../form-control/form-control-card.component";

import { RadioButtonBaseDirective } from "./radio-button-base.directive";
import { RadioInputComponent } from "./radio-input.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-radio-button-card",
  templateUrl: "radio-button-card.component.html",
  imports: [FormControlCardComponent, RadioInputComponent],
  host: { "[id]": "base.id()" },
  hostDirectives: [
    {
      directive: RadioButtonBaseDirective,
      inputs: ["value", "disabled", "id"],
    },
  ],
})
export class RadioButtonCardComponent {
  protected base = inject(RadioButtonBaseDirective);

  @HostBinding("class") classList = ["tw-block", "tw-mb-1"];

  protected onInputChange() {
    this.base.onInputChange();
  }

  protected onBlur() {
    this.base.onBlur();
  }
}
