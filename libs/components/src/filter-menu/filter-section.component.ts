import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  contentChildren,
  forwardRef,
  input,
  linkedSignal,
} from "@angular/core";

import { FilterOptionComponent } from "./filter-option.component";
import { FILTER_ENTRY, FilterEntry } from "./filter-tokens";

/**
 * A labelled group of options within a `bit-filter-menu` menu (e.g. one org's
 * collections). Like `bit-filter-option`, it's **declarative**: it holds the label,
 * collapse state, and its child options; the chip renders the header (with a
 * selected-count berry and, when `collapsible`, a toggle) and the option rows. Its
 * {@link open} state is shared across the popover and the dialog, so collapsing in one
 * is reflected in the other.
 */
@Component({
  selector: "bit-filter-section",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Never shown directly; only instantiates its options. The chip renders the header/rows.
  host: { class: "tw-hidden" },
  providers: [{ provide: FILTER_ENTRY, useExisting: forwardRef(() => FilterSectionComponent) }],
})
export class FilterSectionComponent implements FilterEntry {
  readonly kind = "section" as const;

  /** The section header text. */
  readonly label = input.required<string>();

  /** Whether the header toggles the section open/closed. */
  readonly collapsible = input(false, { transform: booleanAttribute });

  /** Whether the section starts expanded (only meaningful when collapsible). */
  readonly expanded = input(true, { transform: booleanAttribute });

  /**
   * The options directly under this section — the chip renders a row for each, and
   * each of those renders anything nested beneath it. Deliberately not `descendants`,
   * or nested options would also be drawn flat at the section's own level.
   */
  readonly options = contentChildren(FilterOptionComponent);

  /** Every option in the section, nesting included — for the header's selected count. */
  readonly allOptions = contentChildren(FilterOptionComponent, { descendants: true });

  /** Open state, seeded from `expanded` and thereafter driven by the chip's header. */
  readonly open = linkedSignal(() => this.expanded());

  toggle(): void {
    if (this.collapsible()) {
      this.open.update((isOpen) => !isOpen);
    }
  }
}
