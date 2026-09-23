import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  booleanAttribute,
  computed,
  contentChildren,
  forwardRef,
  input,
  linkedSignal,
  viewChild,
} from "@angular/core";

import { IconTileOptions } from "../icon-tile";

import { FILTER_ENTRY, FilterOptionRow } from "./filter-tokens";

/** Icon tile configuration for a `bit-filter-option` row. */
export type FilterOptionIconTile = IconTileOptions;

/**
 * A node in a data-driven option tree passed to {@link FilterMenuComponent.options} or
 * {@link FilterSectionComponent.options} — the shape of an arbitrarily deep tree whose depth
 * isn't known ahead of time.
 */
export type FilterOptionNode<T = unknown> = {
  value: T;
  label: string;
  /** Overrides the host's automatic count — see {@link FilterOptionComponent.count}. */
  count?: number;
  options?: readonly FilterOptionNode<T>[];
  /**
   * Draws a divider immediately before this node. Only meaningful at the top level of
   * {@link FilterMenuComponent.options} — mirrors `bit-filter-option-divider`, which a
   * data-driven tree can't project directly since a non-empty `options` input takes
   * precedence over projected content.
   */
  dividerBefore?: boolean;
};

/**
 * A selectable option inside a `bit-filter-menu`. Nesting requires `multiple`.
 *
 * @example
 * ```html
 * <bit-filter-option [value]="'engineering'" [iconTile]="{ icon: 'bwi-globe', variant: 'teal' }">
 *   Engineering
 *   <bit-filter-option [value]="'monitoring'">Monitoring</bit-filter-option>
 * </bit-filter-option>
 * ```
 *
 * For a data-driven tree of unknown depth, pass {@link FilterMenuComponent.options} instead —
 * the menu renders the full tree without any `bit-filter-option` markup in the consumer's template.
 */
@Component({
  selector: "bit-filter-option",
  template: `<span #label><ng-content></ng-content></span
    ><ng-content select="bit-filter-option"></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-hidden" },
  providers: [{ provide: FILTER_ENTRY, useExisting: forwardRef(() => FilterOptionComponent) }],
})
export class FilterOptionComponent<T = unknown> implements FilterOptionRow {
  readonly kind = "option" as const;

  /** The value contributed to the chip's selection when chosen. */
  readonly value = input.required<T>();

  /**
   * Optional trailing count. Overrides the host's automatic count (how many rows match
   * this option) — set it for server-side filtering, where the host can't compute the
   * count itself.
   */
  readonly count = input<number>();

  /** Whether the option is selectable. */
  readonly disabled = input(false, { transform: booleanAttribute });

  /** Optional icon tile shown at the start of the option row. */
  readonly iconTile = input<FilterOptionIconTile>();

  /** Whether a parent option starts expanded. Ignored when it has no children. */
  readonly expanded = input(false, { transform: booleanAttribute });

  /** Directly nested options — a non-empty list makes this row an expandable parent. */
  readonly children = contentChildren<FilterOptionComponent>(
    forwardRef(() => FilterOptionComponent),
  );

  /** Whether this option has anything nested under it. */
  readonly hasChildren = computed(() => this.children().length > 0);

  /** @see FilterRow.expandable — an option expands when something is nested under it. */
  readonly expandable = this.hasChildren;

  /** Expansion state, seeded from `expanded` and thereafter driven by the chip's row. */
  readonly open = linkedSignal(() => this.expanded());

  private readonly labelEl = viewChild<ElementRef<HTMLElement>>("label");

  /** The projected label text — the chip renders it, and reads it for search and the summary. */
  label(): string {
    return this.labelEl()?.nativeElement.textContent?.trim() ?? "";
  }

  toggleExpanded(): void {
    this.open.update((isOpen) => !isOpen);
  }
}
