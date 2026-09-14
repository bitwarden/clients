import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  contentChildren,
  forwardRef,
  input,
  linkedSignal,
  signal,
} from "@angular/core";

import { FilterOptionComponent } from "./filter-option.component";
import { FILTER_ENTRY, FilterRow } from "./filter-tokens";

/** A labelled group of options within a `bit-filter-menu`. */
@Component({
  selector: "bit-filter-section",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Never shown directly; only instantiates its options. The chip renders the header/rows.
  host: { class: "tw-hidden" },
  providers: [{ provide: FILTER_ENTRY, useExisting: forwardRef(() => FilterSectionComponent) }],
})
export class FilterSectionComponent implements FilterRow {
  readonly kind = "section" as const;

  /** The section header text. */
  readonly label = input.required<string>();

  /** Whether the header toggles the section open/closed. */
  readonly collapsible = input(false, { transform: booleanAttribute });

  /** @see FilterRow.expandable — a section expands when its header is a toggle. */
  readonly expandable = this.collapsible;

  /** @see FilterRow.disabled — a header isn't selectable, so it's never disabled. */
  readonly disabled = signal(false).asReadonly();

  /** Whether the section starts expanded (only meaningful when collapsible). */
  readonly expanded = input(true, { transform: booleanAttribute });

  /** Not `descendants`, or nested options would also be drawn flat at this level. */
  readonly options = contentChildren(FilterOptionComponent);

  /** @see FilterRow.children */
  readonly children = this.options;

  /** Every option in the section, nesting included — for the header's selected count. */
  readonly allOptions = contentChildren(FilterOptionComponent, { descendants: true });

  /** Open state, seeded from `expanded` and thereafter driven by the chip's header. */
  readonly open = linkedSignal(() => this.expanded());

  toggleExpanded(): void {
    if (this.collapsible()) {
      this.open.update((isOpen) => !isOpen);
    }
  }
}
