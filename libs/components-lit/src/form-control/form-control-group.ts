import { PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitChoiceElement } from "./choice-element";
import { BitGroupElement } from "./group-element";

/**
 * Groups checkboxes or switches (or their cards) under a legend, with a shared hint and error.
 *
 * With a `name`, the group is a form control whose value is the `value`s of its checked items
 * (submitted as repeated entries); the items then don't submit themselves. `required` means at
 * least one item must be checked. Without a `name` it's purely a layout, and each item keeps its
 * own name and value.
 *
 * Inherits the slots of `BitGroupElement`.
 *
 * @fires change - Bubbled from the item the user toggled.
 */
@customElement("bit-form-control-group")
export class BitFormControlGroup extends BitGroupElement<string[]> {
  @property({ attribute: false }) value: string[] = [];

  protected readonly groupRole = "group";

  // Checkbox groups always stack (Angular "multi" mode).
  protected get stacked() {
    return true;
  }

  protected get items(): BitChoiceElement[] {
    return Array.from(this.querySelectorAll<BitChoiceElement>("bit-checkbox, bit-switch"));
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("change", this.onItemChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("change", this.onItemChange);
  }

  private defaultValue: string[] = [];

  protected firstUpdated(changed: PropertyValues) {
    super.firstUpdated(changed);
    if (this.value.length === 0) {
      this.value = this.checkedValues();
    }
    this.defaultValue = [...this.value];
  }

  formResetCallback() {
    super.formResetCallback();
    this.value = [...this.defaultValue];
  }

  protected syncItems() {
    super.syncItems();
    for (const item of this.items) {
      item.grouped = !!this.name;
      if (this.name) {
        item.checked = this.value.includes(item.value);
      }
    }
  }

  protected toFormValue(value: string[]) {
    return this.name ? super.toFormValue(value) : null;
  }

  private checkedValues() {
    return this.items.filter((item) => item.checked).map((item) => item.value);
  }

  private onItemChange = (event: Event) => {
    if (event.target === this) {
      return;
    }
    this.value = this.checkedValues();
    this.dirty = true;
    this.internals.setFormValue(this.toFormValue(this.value));
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-form-control-group": BitFormControlGroup;
  }
}
