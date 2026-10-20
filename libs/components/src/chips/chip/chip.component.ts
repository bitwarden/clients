import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { FocusableElement } from "../../shared/focusable-element";
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
  providers: [{ provide: FocusableElement, useExisting: ChipComponent }],
  hostDirectives: [
    {
      directive: BaseChipDirective,
      inputs: ["size", "disabled"],
    },
  ],
})
export class ChipComponent implements FocusableElement {
  protected readonly baseChip = inject(BaseChipDirective, { host: true });

  private readonly dismissButton = viewChild.required(ChipDismissButtonComponent, {
    read: ElementRef<HTMLButtonElement>,
  });

  constructor() {
    this.baseChip.hasTrailingIcon.set(true);
  }

  /**
   * The label text for the chip.
   */
  readonly label = input<string>("");

  readonly startIcon = input<BitwardenIcon | undefined>();

  /**
   * Provide a specific accessible name for the dismiss button if you want to use something
   * different than the chip's label for the dismiss button.
   */
  readonly accessibleName = input<string>();

  /**
   * Output event emitted when the dismiss button is clicked. Does not emit if the chip is disabled.
   */
  readonly dismissed = output<void>();

  /** The dismiss button is the chip's only control. */
  getFocusTarget() {
    return this.dismissButton().nativeElement;
  }

  protected handleDismiss(event: MouseEvent) {
    event.stopPropagation();
    if (!this.baseChip.disabled()) {
      this.dismissed.emit();
    }
  }
}
