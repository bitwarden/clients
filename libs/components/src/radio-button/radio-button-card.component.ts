import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { FormControlCardComponent } from "../form-control/form-control-card.component";

import { RadioButtonBaseDirective } from "./radio-button-base.directive";
import { RadioInputComponent } from "./radio-input.component";

@Component({
  selector: "bit-radio-button-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "radio-button-card.component.html",
  imports: [FormControlCardComponent, RadioInputComponent],
  host: {
    "[id]": "base.id()",
    class: "tw-block",
  },
  hostDirectives: [
    {
      directive: RadioButtonBaseDirective,
      inputs: ["value", "disabled", "id"],
    },
  ],
})
export class RadioButtonCardComponent {
  protected readonly base = inject(RadioButtonBaseDirective);

  protected onInputChange() {
    this.base.onInputChange();
  }

  protected onBlur() {
    this.base.onBlur();
  }
}
