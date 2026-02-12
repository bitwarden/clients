import { Component, ChangeDetectionStrategy, booleanAttribute, input } from "@angular/core";

import { BitwardenIcon } from "../../shared/icon";
import {
  BaseChipDirective,
  type ChipVariant,
  type ChipSize,
  ChipVariants,
  ChipSizes,
} from "../base-chip.directive";
import { ChipContentComponent } from "../chip-content.component";

@Component({
  selector: "a[bitChipAction], button[bitChipAction]",
  standalone: true,
  imports: [ChipContentComponent],
  templateUrl: "./chip-action.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: BaseChipDirective,
      inputs: ["variant", "size", "disabled", "fullWidth"],
    },
  ],
})
export class ChipActionComponent {
  readonly variant = input<ChipVariant>(ChipVariants.Primary);
  readonly size = input<ChipSize>(ChipSizes.Large);

  readonly disabled = input<boolean, unknown>(false, { transform: booleanAttribute });
  readonly fullWidth = input<boolean, unknown>(false, { transform: booleanAttribute });

  readonly startIcon = input<BitwardenIcon>();
  readonly endIcon = input<BitwardenIcon>();
  readonly label = input<string>("");
}
