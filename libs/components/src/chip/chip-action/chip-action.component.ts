import { Component, ChangeDetectionStrategy, input, inject } from "@angular/core";

import { BitwardenIcon } from "../../shared/icon";
import { BaseChipDirective } from "../base-chip.directive";
import { ChipContentComponent } from "../chip-content.component";

@Component({
  selector: "a[bit-chip-action], button[bit-chip-action]",
  imports: [ChipContentComponent],
  templateUrl: "./chip-action.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: BaseChipDirective,
      inputs: ["variant", "size", "disabled"],
    },
  ],
})
export class ChipActionComponent {
  readonly baseChip = inject(BaseChipDirective, { host: true });

  readonly startIcon = input<BitwardenIcon>();
  readonly endIcon = input<BitwardenIcon>();
  readonly label = input<string>("");
}
