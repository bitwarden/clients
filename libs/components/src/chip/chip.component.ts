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

import { IconComponent } from "../icon/icon.component";
import { BitwardenIcon } from "../shared/icon";

@Component({
  selector: "[bitChip]",
  standalone: true,
  imports: [IconComponent],
  templateUrl: "./chip.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    "[class]":
      '"tw-inline-flex tw-px-2 tw-py-1 tw-rounded-md tw-items-center tw-gap-2 tw-rounded-full tw-border tw-max-w-52 tw-transition-colors [&:is(button)]:tw-appearance-none [&:is(button)]:tw-outline-none [&:is(button)]:tw-bg-transparent"',

    // State-based classes
    "[class.tw-opacity-50]": "disabled()",
    "[class.tw-pointer-events-none]": "disabled()",
    "[class.tw-w-full]": "fullWidth()",
    "[class.tw-ring-2]": "focusVisibleWithin()",

    // Events
    "(click)": "handleClick($event)",
    "(focusin)": "onFocusIn()",
    "(focusout)": "onFocusOut()",
  },
})
export class ChipComponent {
  // Inputs
  readonly selected = input<boolean>(false);
  readonly disabled = input<boolean, unknown>(false, { transform: booleanAttribute });
  readonly fullWidth = input<boolean, unknown>(false, { transform: booleanAttribute });
  readonly dismissible = input<boolean, unknown>(false, { transform: booleanAttribute });
  readonly startIcon = input<BitwardenIcon>();
  readonly endIcon = input<BitwardenIcon>();
  readonly label = input<string>();

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
