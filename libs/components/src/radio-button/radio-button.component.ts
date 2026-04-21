import { booleanAttribute, Component, inject, input } from "@angular/core";

import { FormControlGroupComponent } from "../form-control/form-control-group.component";
import { FormControlModule } from "../form-control/form-control.module";

import { RadioInputComponent } from "./radio-input.component";

let nextId = 0;

/**
 * @deprecated Use `<bit-form-control>` or `<bit-form-control-card>` with
 * `<input type="radio" bitRadio [value]="...">` directly.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-radio-button",
  templateUrl: "radio-button.component.html",
  imports: [FormControlModule, RadioInputComponent],
  host: {
    "[id]": "id()",
    class: "[&_bit-hint]:tw-mt-0",
    "[class.tw-block]": "block",
    "[class.tw-inline-block]": "!block",
  },
})
export class RadioButtonComponent {
  private readonly group = inject(FormControlGroupComponent, { optional: true });

  readonly id = input(`bit-radio-button-${nextId++}`);
  readonly value = input<unknown>();
  readonly disabled = input(false, { transform: booleanAttribute });

  get block() {
    return this.group?.block() ?? false;
  }

  get selected() {
    return this.group?.selectedValues().includes(this.value()) ?? false;
  }

  get inputId() {
    return `${this.id()}-input`;
  }
}
