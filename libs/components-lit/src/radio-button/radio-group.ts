import { PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitGroupElement } from "../form-control/group-element";

import { BitRadio } from "./radio";

/**
 * Single-select group of `bit-radio`s (Angular `bit-radio-group` / `bit-form-control-group` with
 * radios). Form-associated: submits `value` under `name`. Arrow keys move and select like native
 * radios; only the selected (or first) radio is in the tab order.
 *
 * Inherits the slots of `BitGroupElement`.
 *
 * @fires change - When the user selects a radio.
 */
@customElement("bit-radio-group")
export class BitRadioGroup extends BitGroupElement<string> {
  /** Value of the selected radio. Radio groups should always have a default selection. */
  @property() value = "";

  protected readonly groupRole = "radiogroup";

  protected get items(): BitRadio[] {
    return Array.from(this.querySelectorAll("bit-radio"));
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("bit-radio-select", this.onSelect);
    this.addEventListener("keydown", this.onKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("bit-radio-select", this.onSelect);
    this.removeEventListener("keydown", this.onKeyDown);
  }

  protected firstUpdated(changed: PropertyValues) {
    super.firstUpdated(changed);
    if (!this.value) {
      const checked = this.items.find((radio) => radio.checked);
      if (checked) {
        this.value = checked.value;
      }
    }
  }

  protected syncItems() {
    super.syncItems();
    const radios = this.items;
    const enabled = radios.filter((radio) => !radio.isDisabled);
    const selected = enabled.find((radio) => radio.value === this.value);
    const tabStop = selected ?? enabled[0];
    for (const radio of radios) {
      radio.checked = radio.value === this.value;
      radio.tabbable = radio === tabStop;
    }
  }

  private select(radio: BitRadio) {
    if (radio.isDisabled || radio.value === this.value) {
      return;
    }
    this.value = radio.value;
    this.dirty = true;
    this.internals.setFormValue(this.value);
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  }

  private onSelect = (event: Event) => {
    const radio = event.composedPath().find((el): el is BitRadio => el instanceof BitRadio);
    if (radio) {
      this.select(radio);
    }
  };

  private onKeyDown = (event: KeyboardEvent) => {
    const current = event.composedPath().find((el): el is BitRadio => el instanceof BitRadio);
    if (!current || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const rtl = getComputedStyle(this).direction === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    let step = 0;
    if (event.key === "ArrowDown" || event.key === forward) {
      step = 1;
    } else if (event.key === "ArrowUp" || event.key === backward) {
      step = -1;
    } else {
      return;
    }
    event.preventDefault();
    const enabled = this.items.filter((radio) => !radio.isDisabled);
    const index = enabled.indexOf(current);
    const next = enabled[(index + step + enabled.length) % enabled.length];
    if (next) {
      this.select(next);
      next.focus();
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-radio-group": BitRadioGroup;
  }
}
