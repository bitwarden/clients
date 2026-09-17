import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  contentChildren,
  forwardRef,
  input,
  linkedSignal,
  signal,
} from "@angular/core";

import { FilterOptionComponent, FilterOptionNode } from "./filter-option.component";
import {
  FILTER_ENTRY,
  FilterOptionRow,
  FilterRow,
  buildOptionRows,
  createFilterOptionOpenState,
  flattenFilterOptions,
} from "./filter-tokens";

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

  /**
   * A data-driven option tree for this section — renders the full nested structure without
   * any `bit-filter-option` markup in the consumer's template.
   */
  readonly options = input<FilterOptionNode<unknown>[]>([]);

  // Default `descendants: false` — nested options are reached through each option's own
  // `children()`, not this query, so a nested option is never also drawn flat at this level.
  private readonly _contentOptions = contentChildren(FilterOptionComponent);

  /** Persists each data-driven row's expanded state across rebuilds of {@link _dataOptions}. */
  private readonly _openState = createFilterOptionOpenState();

  private readonly _dataOptions = computed(() => buildOptionRows(this.options(), this._openState));

  /** @see FilterRow.children */
  readonly children = computed<readonly FilterOptionRow[]>(() => {
    if (this._dataOptions().length > 0) {
      return this._dataOptions();
    }

    return this._contentOptions();
  });

  /** Every option in the section, nesting included — for the header's selected count. */
  readonly allOptions = computed(() => flattenFilterOptions(this.children()));

  /** Open state, seeded from `expanded` and thereafter driven by the chip's header. */
  readonly open = linkedSignal(() => this.expanded());

  toggleExpanded(): void {
    if (this.collapsible()) {
      this.open.update((isOpen) => !isOpen);
    }
  }
}
