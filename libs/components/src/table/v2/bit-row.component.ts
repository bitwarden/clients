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
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitRowComponent {
  private readonly table = inject(
    forwardRef(() => BitTableV2Component),
    { optional: true },
  );

  protected readonly gridTemplateColumns = computed(() => this.table?.gridTemplateColumns());

  /**
   * Row chrome. The grid classes lay the cells out in both presentations; the
   * rest is presentation-specific: `table` connects rows with a top divider,
   * `list` renders each row as a standalone `bit-item`-style card (background,
   * rounded corners, spacing, hover).
   */
  protected readonly hostClasses = computed(() => {
    // `group/row` lets cell templates reveal row-hover affordances (e.g. quick
    // copy/launch actions) with `group-hover/row:*`. Rows don't nest, so the
    // shared group name scopes to each row's own subtree without collisions.
    const layout = "tw-group/row tw-grid tw-grid-flow-col tw-auto-cols-fr";
    if (this.table?.presentation() === "list") {
      // `list` rows size to content off a `bit-item`-style minimum height.
      return `${layout} tw-min-h-9 tw-mb-1.5 tw-rounded-lg tw-bg-background tw-border-0 tw-border-b tw-border-solid tw-border-b-shadow hover:tw-bg-hover-default`;
    }
    // `table` rows own the fixed row height; cells stretch to fill it and center content.
    return `${layout} tw-h-16 tw-border-0 tw-border-t tw-border-solid tw-border-border-base first:tw-border-t-0`;
  });
}
