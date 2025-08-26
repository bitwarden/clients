import { NgClass } from "@angular/common";
import {
  AfterContentChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  signal,
  input,
  viewChild,
} from "@angular/core";

import { TypographyModule } from "../typography";

@Component({
  selector: "bit-item-content, [bit-item-content]",
  imports: [TypographyModule, NgClass],
  templateUrl: `item-content.component.html`,
  host: {
    class:
      /**
       * y-axis padding should be kept in sync with `item-action.component.ts`'s `top` and `bottom` units.
       * we want this to be the same height as the `item-action`'s `:after` element
       */
      "tw-outline-none tw-text-main hover:tw-text-main tw-no-underline hover:tw-no-underline tw-text-base tw-py-2 tw-px-4 bit-compact:tw-py-1.5 bit-compact:tw-px-2 tw-bg-transparent tw-w-full tw-border-none tw-flex tw-gap-4 tw-items-center tw-justify-between disabled:tw-cursor-not-allowed [&[disabled]_[bittypography]]:!tw-text-secondary-300 [&[disabled]_i]:!tw-text-secondary-300",
    "data-fvw-target": "",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemContentComponent implements AfterContentChecked {
  readonly endSlot = viewChild<ElementRef<HTMLDivElement>>("endSlot");

  protected endSlotHasChildren = signal(false);

  /**
   * Determines whether text will truncate or wrap.
   *
   * Default behavior is truncation.
   */
  readonly truncate = input(true);

  ngAfterContentChecked(): void {
    this.endSlotHasChildren.set((this.endSlot()?.nativeElement.childElementCount ?? 0) > 0);
  }
}
