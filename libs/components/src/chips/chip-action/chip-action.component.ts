import { Component, ChangeDetectionStrategy, input, inject } from "@angular/core";

import { BitwardenIcon } from "../../shared/icon";
import { BaseChipDirective } from "../shared/base-chip.directive";
import { ChipContentComponent } from "../shared/chip-content.component";

/**
 * Action chips trigger a single contextual action related to the current view or task. They do not
 * have selection state and do not manage input. Use action chips for quick, one-off actions like
 * filtering, sorting, or navigating to related content.
 */
@Component({
  selector: "a[bit-chip-action], button[bit-chip-action]",
  imports: [ChipContentComponent],
  templateUrl: "./chip-action.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: BaseChipDirective,
      inputs: ["variant", "size", "disabled", "maxWidthClass"],
    },
  ],
})
export class ChipActionComponent {
  readonly baseChip = inject(BaseChipDirective, { host: true });

  readonly startIcon = input<BitwardenIcon>();
  readonly label = input<string>("");
}
