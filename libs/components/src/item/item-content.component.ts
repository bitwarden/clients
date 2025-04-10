// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { NgClass } from "@angular/common";
import {
  AfterContentChecked,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  signal,
  ViewChild,
} from "@angular/core";

import { TypographyModule } from "../typography";

@Component({
  selector: "bit-item-content, [bit-item-content]",
  standalone: true,
  imports: [TypographyModule, NgClass],
  templateUrl: `item-content.component.html`,
  host: {
    class:
      /**
       * y-axis padding should be kept in sync with `item-action.component.ts`'s `top` and `bottom` units.
       * we want this to be the same height as the `item-action`'s `:after` element
       */
      "fvw-target tw-outline-none tw-text-main hover:tw-text-main tw-no-underline hover:tw-no-underline tw-text-base tw-py-2 tw-px-4 bit-compact:tw-py-1.5 bit-compact:tw-px-2 tw-bg-transparent tw-w-full tw-border-none tw-flex tw-gap-4 tw-items-center tw-justify-between",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemContentComponent implements AfterContentChecked {
  @ViewChild("endSlot") endSlot: ElementRef<HTMLDivElement>;

  protected endSlotHasChildren = signal(false);

  /**
   * Determines whether text will truncate or wrap.
   *
   * Default behavior is truncation.
   */
  @Input() truncate = true;

  ngAfterContentChecked(): void {
    this.endSlotHasChildren.set(this.endSlot?.nativeElement.childElementCount > 0);
  }
}
