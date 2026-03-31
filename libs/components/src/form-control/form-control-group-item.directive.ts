import { computed, Directive, inject, input } from "@angular/core";

import { FormControlGroupComponent } from "./form-control-group.component";

@Directive({
  selector: "[bitFormControlGroupItem]",
})
export class FormControlGroupItemDirective {
  readonly group = inject(FormControlGroupComponent, { optional: true });

  // Optional — undefined is safe when used outside a group
  readonly value = input<unknown>();

  readonly isSelected = computed(() => {
    if (!this.group) {
      return false;
    }
    return this.group.selectedValues().has(this.value());
  });

  readonly isDisabled = computed(() => this.group?.groupDisabled() ?? false);

  notifyChange(): void {
    this.group?.onItemChange(this.value());
  }

  notifyBlur(): void {
    this.group?.onBlur();
  }
}
