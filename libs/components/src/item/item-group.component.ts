import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, Signal } from "@angular/core";

import { SegmentedCardComponent } from "../card";

@Component({
  selector: "bit-item-group",
  imports: [NgTemplateOutlet, SegmentedCardComponent],
  template: `
    <ng-template #content><ng-content></ng-content></ng-template>
    @if (joined()) {
      <bit-card-segmented class="tw-overflow-hidden">
        <ng-container [ngTemplateOutlet]="content"></ng-container>
      </bit-card-segmented>
    } @else {
      <ng-container [ngTemplateOutlet]="content"></ng-container>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block",
  },
})
export class ItemGroupComponent {
  /**
   * When `true`, the group renders its items inside a single segmented card — one outer
   * border with a divider between each item — and `bit-item` drops its own border, radius,
   * and margin so the items read as one joined card.
   *
   * Exposed as a read-only `Signal` (not `InputSignal`) so other group-like components — e.g.
   * `bit-item-group-accordion` — can satisfy the same contract that `bit-item` injects.
   */
  readonly joined: Signal<boolean> = input(false);
}
