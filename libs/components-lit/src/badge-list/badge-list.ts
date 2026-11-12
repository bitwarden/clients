import { html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { BadgeVariant } from "../badge/badge";
import "../badge/badge";
import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";

/**
 * @deprecated Use `bit-badge-group` instead. This component remains for backwards compatibility.
 *
 * Displays a collection of badges in a horizontal, wrapping layout. When `maxItems` is exceeded,
 * a "+N more" badge replaces the overflow. Badges are comma-separated for screen readers.
 */
@customElement("bit-badge-list")
export class BitBadgeList extends BitElement {
  /** The visual variant to apply to all badges in the list. */
  @property() variant: BadgeVariant = "primary";

  /** Items to display as badges. */
  @property({ type: Array }) items: string[] = [];

  /** Don't truncate long badge text. */
  @property({ type: Boolean, attribute: "no-truncate" }) noTruncate = false;

  /** Maximum number of badges to display, including the "+N more" badge. Minimum 1. */
  @property({ type: Number, attribute: "max-items" }) maxItems?: number;

  private get filteredItems() {
    const max = this.maxItems == null ? undefined : Math.max(1, this.maxItems);
    if (max == null || this.items.length <= max) {
      return this.items;
    }
    return this.items.slice(0, max - 1);
  }

  render() {
    const filtered = this.filteredItems;
    const isFiltered = this.items.length > filtered.length;
    return html`<div class="tw-inline-flex tw-flex-wrap tw-gap-2">
      ${filtered.map(
        (item, i) =>
          html`<bit-badge variant=${this.variant} ?no-truncate=${this.noTruncate}>${item}</bit-badge
            >${
              i < filtered.length - 1 || isFiltered
                ? html`<span class="tw-sr-only">, </span>`
                : nothing
            }`,
      )}
      ${
        isFiltered
          ? html`<bit-badge variant=${this.variant}
              >${t("plusNMore", (this.items.length - filtered.length).toString())}</bit-badge
            >`
          : nothing
      }
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-badge-list": BitBadgeList;
  }
}
