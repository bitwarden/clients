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
  viewChildren,
} from "@angular/core";

import { IconTileOptions } from "../icon-tile";

import { FILTER_ENTRY, FilterRow } from "./filter-tokens";

/** Icon tile configuration for a `bit-filter-option` row. */
export type FilterOptionIconTile = IconTileOptions;

/**
 * A data-driven node for {@link FilterOptionComponent.nested} — the shape of an arbitrarily deep
 * option tree whose depth isn't known ahead of time, so it can't be written as literal nested
 * `bit-filter-option` markup.
 */
export type FilterOptionNode<T = unknown> = {
  value: T;
  label: string;
  /** Overrides the host's automatic count — see {@link FilterOptionComponent.count}. */
  count?: number;
  nested?: readonly FilterOptionNode<T>[];
};

/**
 * A selectable option inside a `bit-filter-menu`. Nesting requires `multiple`.
 *
 * Nested options are usually literal markup:
 * @example
 * ```html
 * <bit-filter-option [value]="'engineering'" [iconTile]="{ icon: 'bwi-globe', variant: 'teal' }">
 *   Engineering
 *   <bit-filter-option [value]="'monitoring'">Monitoring</bit-filter-option>
 * </bit-filter-option>
 * ```
 *
 * For a tree built from data instead — depth unknown ahead of time — pass {@link nested} and skip
 * the markup:
 * @example
 * ```html
 * <bit-filter-option [value]="folder.id" [nested]="folder.children">{{ folder.name }}</bit-filter-option>
 * ```
 */
@Component({
  selector: "bit-filter-option",
  template: `<span #label><ng-content></ng-content></span
    ><ng-content select="bit-filter-option"></ng-content>
    @for (item of nested(); track item.value) {
      <bit-filter-option [value]="item.value" [count]="item.count" [nested]="item.nested ?? []">{{
        item.label
      }}</bit-filter-option>
    }`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "tw-hidden" },
  imports: [forwardRef(() => FilterOptionComponent)],
  providers: [{ provide: FILTER_ENTRY, useExisting: forwardRef(() => FilterOptionComponent) }],
})
export class FilterOptionComponent<T = unknown> implements FilterRow {
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

  /**
   * A data-driven subtree to render instead of literal nested markup — see the class doc's
   * second example. Recurses through this same component, so an arbitrarily deep tree needs no
   * markup of its own beyond this one binding.
   */
  readonly nested = input<readonly FilterOptionNode<T>[]>([]);

  /**
   * Literal nested `bit-filter-option` markup — direct content, not `descendants`. Ignored once
   * {@link nested} is set; see {@link children}.
   */
  private readonly projectedChildren = contentChildren<FilterOptionComponent>(
    forwardRef(() => FilterOptionComponent),
  );

  /**
   * Options this component rendered itself from {@link nested}. These live in its own view
   * (built by its own template's `@for`), not its projected content, so `viewChildren` finds
   * them where `contentChildren` can't — and each nested level resolves its own `nested` the
   * same way, so this never reaches past this component's immediate children.
   */
  private readonly nestedChildren = viewChildren<FilterOptionComponent>(
    forwardRef(() => FilterOptionComponent),
  );

  /**
   * Directly nested options — a non-empty list makes this row an expandable parent.
   *
   * `nested` and literal content are two alternative ways of nesting, not two that compose on
   * the same option — so `nested` wins outright once it's set, rather than merging with
   * whatever's also (unusually) projected as content.
   */
  readonly children = computed<readonly FilterOptionComponent[]>(() =>
    this.nested().length > 0 ? this.nestedChildren() : this.projectedChildren(),
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
