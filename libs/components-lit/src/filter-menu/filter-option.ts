import { css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import { FilterEntryChildren, FilterEntryRegistration } from "./filter-entry-registry";
import type { FilterOptionIconTile, FilterOptionRow } from "./filter-model";

/**
 * A selectable option inside a `bit-filter-menu`. Its text is the label; nested
 * `bit-filter-option`s make it an expandable parent (nesting requires `multiple`). Never shown
 * itself — the chip draws the rows.
 *
 * ```html
 * <bit-filter-option value="engineering" .iconTile=${{ icon: "bwi-globe", variant: "teal" }}>
 *   Engineering
 *   <bit-filter-option value="monitoring">Monitoring</bit-filter-option>
 * </bit-filter-option>
 * ```
 *
 * For a data-driven tree of unknown depth, set `options` on the menu instead.
 */
@customElement("bit-filter-option")
export class BitFilterOption extends BitElement implements FilterOptionRow {
  static styles = css`
    :host {
      display: none !important;
    }
  `;

  readonly kind = "option" as const;

  /** The value contributed to the chip's selection when chosen. The attribute sets a string. */
  @property() value: unknown;

  /**
   * Optional trailing count. Overrides the host's automatic count (how many rows match this
   * option) — set it for server-side filtering, where the host can't compute the count itself.
   */
  @property({ type: Number }) count?: number;

  /** Whether the option is selectable. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Optional icon tile shown at the start of the option row. */
  @property({ attribute: "icon-tile", type: Object }) iconTile?: FilterOptionIconTile;

  /** Whether a parent option starts expanded. Ignored when it has no children. */
  @property({ type: Boolean }) expanded = false;

  /** Expansion state, seeded from `expanded` and thereafter driven by the chip's row. */
  @state() open = false;

  private readonly nested = new FilterEntryChildren(this, () => this.registration.changed());
  private readonly registration = new FilterEntryRegistration(this);

  /** The label: the option's own text, excluding nested options. */
  get label(): string {
    return (
      Array.from(this.childNodes)
        // Comments excluded: frameworks (Lit included) leave marker comments among the children.
        .filter(
          (node) =>
            node.nodeType === Node.TEXT_NODE ||
            (node.nodeType === Node.ELEMENT_NODE && !(node instanceof BitFilterOption)),
        )
        .map((node) => node.textContent ?? "")
        .join("")
        .replace(/\s+/g, " ")
        .trim()
    );
  }

  /** Directly nested options. */
  get childRows(): readonly FilterOptionRow[] {
    return this.nested.list.filter(
      (entry): entry is HTMLElement & FilterOptionRow => entry.kind === "option",
    );
  }

  get expandable(): boolean {
    return this.childRows.length > 0;
  }

  toggleExpanded(): void {
    this.open = !this.open;
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has("expanded")) {
      this.open = this.expanded;
    }
  }

  render() {
    return null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-filter-option": BitFilterOption;
  }
}
