import { css } from "lit";
import { customElement } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import { FilterEntryRegistration } from "./filter-entry-registry";
import type { FilterEntry } from "./filter-model";

/**
 * Separates groups of options within a `bit-filter-menu`. Place it between top-level entries;
 * inside a `bit-filter-section` it has no effect.
 *
 * The chip draws the separation itself, so this never renders: the popover puts a rule between
 * the rows it divides, and the dialog starts a new card instead.
 */
@customElement("bit-filter-option-divider")
export class BitFilterOptionDivider extends BitElement implements FilterEntry {
  static styles = css`
    :host {
      display: none !important;
    }
  `;

  readonly kind = "divider" as const;

  constructor() {
    super();
    new FilterEntryRegistration(this);
  }

  render() {
    return null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-filter-option-divider": BitFilterOptionDivider;
  }
}
