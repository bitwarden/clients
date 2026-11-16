import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from "@angular/core";

import { FormControlGroupComponent } from "../form-control/form-control-group.component";
import { FormControlModule } from "../form-control/form-control.module";

import { RadioInputComponent } from "./radio-input.component";

let nextId = 0;

/**
 * @deprecated Use `<bit-form-control>` or `<bit-form-control-card>` with
 * `<input type="radio" bitRadio [value]="...">` directly.
 */
@Component({
  selector: "bit-radio-button",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "radio-button.component.html",
  imports: [FormControlModule, RadioInputComponent],
  host: {
    "[id]": "id()",
    class: "[&_bit-hint]:tw-mt-0",
    "[class.tw-block]": "block()",
    "[class.tw-inline-block]": "!block()",
  },
})
export class RadioButtonComponent {
  private readonly group = inject(FormControlGroupComponent, { optional: true });

  readonly id = input(`bit-radio-button-${nextId++}`);
  readonly value = input<unknown>();
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly block = computed(() => this.group?.block() ?? false);

  readonly selected = computed(() => this.group?.selectedValues().includes(this.value()) ?? false);

  protected readonly inputId = computed(() => `${this.id()}-input`);
}
