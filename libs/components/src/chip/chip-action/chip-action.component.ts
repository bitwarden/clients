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
      inputs: ["variant", "size"],
    },
  ],
  host: {
    // State-based attributes
    "[attr.disabled]": "disabled() ? true : null",

    // Events
    "(click)": "handleClick($event)",
    "(focusin)": "onFocusIn()",
    "(focusout)": "onFocusOut()",
  },
})
export class ChipActionComponent {
  readonly variant = input<ChipVariant>(ChipVariants.Primary);
  readonly size = input<ChipSize>(ChipSizes.Large);

  // Behavioral inputs
  readonly disabled = input<boolean, unknown>(false, { transform: booleanAttribute });
  readonly fullWidth = input<boolean, unknown>(false, { transform: booleanAttribute });

  // Content inputs
  readonly startIcon = input<BitwardenIcon>();
  readonly endIcon = input<BitwardenIcon>();
  readonly label = input<string>("");
}
