import { computed, Directive, inject, input } from "@angular/core";

import { FormControlGroupComponent } from "./form-control-group.component";

@Directive({
  selector: "[bitFormControlGroupItem]",
})
export class FormControlGroupItemDirective {
  readonly group = inject(FormControlGroupComponent, { optional: true });

  // Optional — undefined is safe when used outside a group
  // When `value` is provided, this card participates in group selection:
  // `isSelected` is derived by matching `value` against the group's `selectedValues`.
  // Omitting `value` opts the card out of group selection even when nested inside a group.
  readonly value = input<unknown>();

  readonly isSelected = computed(() => {
    if (!this.group) {
      return false;
    }
    return this.group.selectedValues().includes(this.value());
  });

  readonly isDisabled = computed(() => this.group?.groupDisabled() ?? false);

  notifyChange(): void {
    this.group?.onItemChange(this.value());
  }

  notifyBlur(): void {
    this.group?.onBlur();
  }
}
