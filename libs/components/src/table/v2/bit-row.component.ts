import { ChangeDetectionStrategy, Component, computed, forwardRef, inject } from "@angular/core";

import { BitTableV2Component } from "./table-v2.component";

/**
 * A body row. The component host *is* the row element (CSS grid container).
 * Cannot use `display: contents` here because the `cdk-virtual-scroll`
 * directive applies `transform: translateY(...)` to position rows in the
 * virtual viewport, and transform has no effect on contents-display boxes.
 *
 * Grid layout:
 * - In column-def mode, the row reads `gridTemplateColumns` from the parent
 *   `<bit-table-v2>` so all rows align on the same column tracks. Use `1fr`
 *   or explicit pixel widths on `<bit-column>` for cross-row alignment.
 *   Intrinsic sizing keywords (`max-content`, `min-content`) won't align
 *   across rows because each row computes its tracks independently.
 * - In manual mode (no `<bit-column>`), `grid-template-columns` is unset and
 *   the row falls back to `grid-auto-flow: column; grid-auto-columns: 1fr`
 *   so projected `<bit-cell>` children each get an equal share.
 */
@Component({
  selector: "bit-row",
  template: "<ng-content></ng-content>",
  host: {
    role: "row",
    "[class]": "hostClasses()",
    "[style.grid-template-columns]": "gridTemplateColumns()",
    "[style.height.px]": "fixedHeight()",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitRowComponent {
  private readonly table = inject(
    forwardRef(() => BitTableV2Component),
    { optional: true },
  );

  protected readonly gridTemplateColumns = computed(() => this.table?.gridTemplateColumns());

  /** Virtualized rows are positioned by offset, so they must render at exactly the height the scroll strategy assumed. */
  protected readonly fixedHeight = computed(() =>
    this.table?.presentation() === "list" ? undefined : this.table?.virtualRowHeight(),
  );

  /**
   * Row chrome. The grid classes lay the cells out in both presentations; the
   * rest is presentation-specific: `table` connects rows with a bottom divider,
   * `list` renders each row as a standalone `bit-item`-style card (background,
   * rounded corners, spacing, hover).
   */
  protected readonly hostClasses = computed(() =>
    [
      // `group/row` lets cell templates reveal row-hover affordances (e.g. quick
      // copy/launch actions) with `group-hover/row:*`. Rows don't nest, so the
      // shared group name scopes to each row's own subtree without collisions.
      "tw-group/row",
      "tw-grid",
      "tw-grid-flow-col",
      "tw-auto-cols-fr",
      // A fixed height can't absorb a tall cell, so clip it rather than let it overlap the next row.
      ...(this.fixedHeight() != null ? ["tw-overflow-clip"] : []),
      ...(this.table?.presentation() === "list"
        ? // `list` rows size to content off a `bit-item`-style minimum height.
          [
            "tw-min-h-9",
            "tw-mb-1.5",
            "tw-rounded-lg",
            "tw-bg-background",
            "tw-border-0",
            "tw-border-b",
            "tw-border-solid",
            "tw-border-b-shadow",
            "hover:tw-bg-hover-default",
          ]
        : [
            // Omitted when virtualized: a min-height would clamp a `virtualRowHeight`
            // below it, breaking the offsets the scroll strategy positions rows at.
            ...(this.fixedHeight() != null ? [] : ["tw-min-h-14"]),
            "tw-border-0",
            "tw-border-b",
            "tw-border-solid",
            "tw-border-border-base",
            "hover:tw-bg-bg-brand-softer",
            // Focus carries the hover fill plus a ring. Inset so it isn't clipped by
            // the body's scroll container or by a fixed-height row's `overflow-clip`.
            "has-[:focus-visible]:tw-bg-bg-brand-softer",
            "has-[:focus-visible]:tw-ring-2",
            "has-[:focus-visible]:tw-ring-inset",
            "has-[:focus-visible]:tw-ring-border-focus",
            // Outranks the hover and focus rules above on specificity.
            "has-[[data-selection-input]:checked]:tw-bg-bg-brand-soft",
          ]),
    ].join(" "),
  );
}
