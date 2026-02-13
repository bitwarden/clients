import { Component, ChangeDetectionStrategy, inject, input, output } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitwardenIcon } from "../shared/icon";

import { BaseChipDirective } from "./base-chip.directive";
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
      inputs: ["size", "disabled"],
    },
  ],
})
export class ChipComponent {
  protected readonly baseChip = inject(BaseChipDirective, { host: true });

  readonly label = input<string>("");

  readonly startIcon = input<BitwardenIcon | undefined>();

  readonly chipDismissed = output<void>();

  protected handleDismiss(event: MouseEvent) {
    event.stopPropagation();
    if (!this.baseChip.disabled()) {
      this.chipDismissed.emit();
    }
  }
}
