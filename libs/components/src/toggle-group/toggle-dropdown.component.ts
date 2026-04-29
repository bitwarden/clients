import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { BitFormFieldComponent } from "../form-field";
import { Option } from "../select/option";
import { SelectComponent } from "../select/select.component";

@Component({
  selector: "bit-toggle-dropdown",
  template: `
    <bit-form-field disableMargin>
      <bit-select
        [items]="items()"
        [ngModel]="value()"
        (ngModelChange)="valueChange.emit($event)"
      ></bit-select>
    </bit-form-field>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BitFormFieldComponent, SelectComponent, FormsModule],
})
export class ToggleDropdownComponent<T> {
  readonly items = input<Option<T>[]>([]);
  readonly value = input<T | undefined>();
  readonly valueChange = output<T>();
}
