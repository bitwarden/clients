import { Component, ChangeDetectionStrategy, booleanAttribute, input, output } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitwardenIcon } from "../shared/icon";

import {
  BaseChipDirective,
  type ChipVariant,
  type ChipSize,
  ChipVariants,
  ChipSizes,
} from "./base-chip.directive";
import { ChipContentComponent } from "./chip-content.component";
import { ChipDismissButtonComponent } from "./chip-dismiss-button.component";

@Component({
  selector: "bit-chip",
  standalone: true,
  imports: [I18nPipe, ChipContentComponent, ChipDismissButtonComponent],
  templateUrl: "./chip.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: BaseChipDirective,
      inputs: ["variant", "size"],
    },
  ],
  host: {
    "[attr.disabled]": "disabled() ? true : null",
  },
})
export class ChipComponent {
  readonly variant = input<ChipVariant>(ChipVariants.Primary);
  readonly size = input<ChipSize>(ChipSizes.Large);
  readonly label = input<string>("");
  readonly disabled = input<boolean, unknown>(false, { transform: booleanAttribute });
  readonly fullWidth = input<boolean, unknown>(false, { transform: booleanAttribute });

  readonly startIcon = input<BitwardenIcon | undefined>();

  readonly chipDismissed = output<void>();

  protected handleDismiss(event: MouseEvent) {
    event.stopPropagation();
    if (!this.disabled()) {
      this.chipDismissed.emit();
    }
  }
}
