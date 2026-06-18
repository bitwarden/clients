import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";
import { FormsModule } from "@angular/forms";

import { BitFormFieldComponent } from "../form-field";
import { Option } from "../select/option";
import { SelectComponent } from "../select/select.component";

/**
 * @internal Used only by `ToggleGroupComponent` as the responsive fallback —
 * rendered in place of the projected toggle buttons when the container is too
 * narrow to display them inline.
 */
@Component({
  selector: "bit-toggle-dropdown",
  template: `
    @if (label()) {
      <label class="tw-sr-only" [attr.for]="bitSelect.labelForId()">{{ label() }}</label>
    }
    <bit-form-field disableMargin>
      <bit-select
        #bitSelect
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
  readonly label = input<string>();
  readonly valueChange = output<T>();
}
