import { css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import { FilterEntryChildren, FilterEntryRegistration } from "./filter-entry-registry";
import {
  buildOptionRows,
  FilterOptionNode,
  FilterOptionOpenState,
  FilterOptionRow,
  FilterSectionRow,
  flattenFilterOptions,
} from "./filter-model";

/**
 * A labelled group of options within a `bit-filter-menu`. Never shown itself — the chip draws the
 * header and rows, with a berry counting the section's selected options.
 */
@customElement("bit-filter-section")
export class BitFilterSection extends BitElement implements FilterSectionRow {
  static styles = css`
    :host {
      display: none !important;
    }
  `;

  readonly kind = "section" as const;

  /** A header isn't selectable, so it's never disabled. */
  readonly disabled = false;

  /** The section header text. */
  @property() label = "";

  /** Whether the header toggles the section open/closed. */
  @property({ type: Boolean }) collapsible = false;

  /** Whether the section starts expanded (only meaningful when collapsible). */
  @property({ type: Boolean }) expanded = true;

  /**
   * A data-driven option tree for this section. When non-empty it takes precedence over child
   * `bit-filter-option`s.
   */
  @property({ attribute: false }) options: readonly FilterOptionNode<unknown>[] = [];

  /** Open state, seeded from `expanded` and thereafter driven by the chip's header. */
  @state() open = true;

  private readonly openState = new FilterOptionOpenState(() => this.registration.changed());
  private dataRows: FilterOptionRow[] = [];
  private readonly nested = new FilterEntryChildren(this, () => this.registration.changed());
  private readonly registration = new FilterEntryRegistration(this);

  /** Only options count here: a nested divider has no effect inside a section. */
  get childRows(): readonly FilterOptionRow[] {
    if (this.dataRows.length > 0) {
      return this.dataRows;
    }
    return this.nested.list.filter(
      (entry): entry is HTMLElement & FilterOptionRow => entry.kind === "option",
    );
  }

  get expandable(): boolean {
    return this.collapsible;
  }

  get allOptions(): readonly FilterOptionRow[] {
    return flattenFilterOptions(this.childRows);
  }

  toggleExpanded(): void {
    if (this.collapsible) {
      this.open = !this.open;
    }
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has("expanded")) {
      this.open = this.expanded;
    }
    if (changed.has("options")) {
      this.dataRows = buildOptionRows(this.options, this.openState);
    }
  }

  render() {
    return null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-filter-section": BitFilterSection;
  }
}
