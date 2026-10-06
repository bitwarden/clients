import { ChangeDetectionStrategy, Component, computed, forwardRef, inject } from "@angular/core";

import { BitTableV2Component } from "./table-v2.component";

/**
 * A header row. Same grid mechanics as {@link BitRowComponent}, with the
 * header chrome (background, bottom border, body text color) applied via
 * host classes. See `BitRowComponent` for column-alignment notes.
 */
@Component({
  selector: "bit-header-row",
  template: "<ng-content></ng-content>",
  host: {
    role: "row",
    class:
      "tw-grid tw-grid-flow-col tw-auto-cols-fr tw-bg-bg-secondary tw-border-0 tw-border-b tw-border-solid tw-border-border-base tw-text-fg-body",
    "[style.grid-template-columns]": "gridTemplateColumns()",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitHeaderRowComponent {
  private readonly table = inject(
    forwardRef(() => BitTableV2Component),
    { optional: true },
  );

  protected readonly gridTemplateColumns = computed(() => this.table?.gridTemplateColumns());
}
