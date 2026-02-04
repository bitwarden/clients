import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  booleanAttribute,
  input,
  output,
  signal,
  inject,
} from "@angular/core";

import { BitwardenIcon } from "../shared/icon";

import {
  BaseChipDirective,
  type ChipVariant,
  type ChipSize,
  ChipVariants,
  ChipSizes,
} from "./base-chip.directive";
import { ChipContentComponent } from "./chip-content.component";

@Component({
  selector: "a[bitChip], button[bitChip]",
  standalone: true,
  imports: [ChipContentComponent],
  templateUrl: "./chip.component.html",
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
export class ChipComponent {
  readonly variant = input<ChipVariant>(ChipVariants.Primary);
  readonly size = input<ChipSize>(ChipSizes.Large);

  // Behavioral inputs
  readonly disabled = input<boolean, unknown>(false, { transform: booleanAttribute });
  readonly fullWidth = input<boolean, unknown>(false, { transform: booleanAttribute });
  readonly dismissible = input<boolean, unknown>(false, { transform: booleanAttribute });

  // Content inputs
  readonly startIcon = input<BitwardenIcon>();
  readonly endIcon = input<BitwardenIcon>();

  // Outputs
  readonly chipClick = output<MouseEvent>();
  readonly dismissed = output<void>();

  // Internal state
  protected readonly focusVisibleWithin = signal(false);
  private elementRef = inject(ElementRef<HTMLElement>);

  protected onFocusIn() {
    this.focusVisibleWithin.set(
      this.elementRef.nativeElement.matches(":focus-visible") ||
        this.elementRef.nativeElement.querySelector(":focus-visible") !== null,
    );
  }

  protected onFocusOut() {
    this.focusVisibleWithin.set(false);
  }

  protected handleClick(event: MouseEvent) {
    if (!this.disabled()) {
      this.chipClick.emit(event);
    }
  }

  protected handleDismiss(event: MouseEvent) {
    event.stopPropagation();
    if (!this.disabled()) {
      this.dismissed.emit();
    }
  }
}
