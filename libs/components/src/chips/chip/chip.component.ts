import { Component, ChangeDetectionStrategy, inject, input, output } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitwardenIcon } from "../../shared/icon";
import { BaseChipDirective } from "../shared/base-chip.directive";
import { ChipContentComponent } from "../shared/chip-content.component";
import { ChipDismissButtonComponent } from "../shared/chip-dismiss-button.component";

/**
 * Chips represent user-provided values, entities, or selections that can be reviewed, edited, or
 * removed. Use input chips when users are entering or managing multiple discrete items, such as
 * tags, users, or permissions.
 */
@Component({
  selector: "bit-chip",
  imports: [I18nPipe, ChipContentComponent, ChipDismissButtonComponent],
  templateUrl: "./chip.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: BaseChipDirective,
      inputs: ["size", "disabled"],
    },
  ],
})
export class ChipComponent {
  protected readonly baseChip = inject(BaseChipDirective, { host: true });

  constructor() {
    this.baseChip.hasTrailingIcon.set(true);
  }

  /**
   * The label text for the chip.
   */
  readonly label = input<string>("");

  readonly startIcon = input<BitwardenIcon | undefined>();

  /**
   * Output event emitted when the dismiss button is clicked. Does not emit if the chip is disabled.
   */
  readonly dismissed = output<void>();

  protected handleDismiss(event: MouseEvent) {
    event.stopPropagation();
    if (!this.baseChip.disabled()) {
      this.dismissed.emit();
    }
  }
}
