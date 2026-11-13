import { css, LitElement, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { BitwardenIcon } from "../icon/shared-icon";
import type { IconTileOptions } from "../icon-tile/icon-tile-options";

import type { SelectOption } from "./option";

/** @internal Fired by `bit-option` when any of its properties change. */
export const OPTION_CHANGE_EVENT = "bit-option-change";

/**
 * Declares an option of the enclosing `bit-select`. Renders nothing itself.
 *
 * Set `value` as a property for non-string values; from an attribute it is a string.
 */
@customElement("bit-option")
export class BitOption<T = unknown> extends LitElement {
  static styles = css`
    :host {
      display: none;
    }
  `;

  @property() value!: T;

  @property() label = "";

  @property() icon?: BitwardenIcon;

  /**
   * Renders a `bit-icon-tile` in place of the plain `icon`. Takes precedence when both are set.
   * The tile is always rendered at the `xs` size so all options line up. As an attribute, pass
   * JSON: `icon-tile='{"icon": "bwi-star", "variant": "teal"}'`.
   */
  @property({ type: Object, attribute: "icon-tile" }) iconTile?: IconTileOptions;

  @property() description?: string;

  @property({ type: Boolean, reflect: true }) disabled = false;

  /** @internal */
  toOption(): SelectOption<T> {
    return {
      icon: this.icon,
      iconTile: this.iconTile,
      value: this.value,
      label: this.label,
      description: this.description,
      disabled: this.disabled || undefined,
    };
  }

  protected updated(changed: PropertyValues<this>) {
    super.updated(changed);
    this.dispatchEvent(new Event(OPTION_CHANGE_EVENT, { bubbles: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-option": BitOption;
  }
}
