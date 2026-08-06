import { NgClass } from "@angular/common";
import {
  AfterContentChecked,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  signal,
  input,
  viewChild,
} from "@angular/core";

import { TypographyModule } from "../typography";

import { ItemComponent } from "./item.component";

@Component({
  selector: "bit-item-content, [bit-item-content]",
  imports: [TypographyModule, NgClass],
  templateUrl: `item-content.component.html`,
  host: {
    class:
      /**
       * y-axis padding is driven by the parent `bit-item`'s `size` input (`base` -> `tw-py-2`,
       * `lg` -> `tw-py-3`) via `sizeClass`. Compact mode is marked `!important` so it always
       * wins over the size-derived padding.
       */
      "tw-outline-none tw-text-main hover:tw-text-main tw-no-underline hover:tw-no-underline tw-text-base bit-compact:!tw-py-1.5 bit-compact:tw-ps-3 tw-bg-transparent tw-w-full tw-border-none tw-flex tw-gap-4 tw-items-center tw-justify-between disabled:tw-cursor-not-allowed [&[disabled]_[bittypography]]:!tw-text-fg-inactive [&[disabled]_i]:!tw-text-fg-inactive",
    "[class]": "sizeClass()",
    "data-fvw-target": "",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ItemContentComponent implements AfterContentChecked {
  private readonly item = inject(ItemComponent, { optional: true });

  readonly endSlot = viewChild<ElementRef<HTMLDivElement>>("endSlot");

  protected readonly endSlotHasChildren = signal(false);

  protected readonly sizeClass = computed(() =>
    this.item?.size() === "lg" ? "tw-py-3" : "tw-py-2",
  );

  private readonly sizePadding = computed(() =>
    this.item?.size() === "lg" ? "tw-pe-4" : "tw-pe-3",
  );

  private readonly endSlotOverrides =
    "[&:has(>bit-item-action:last-child>button[bitIconButton],>button[bitIconButton]:last-child)]:tw-pe-2 bit-compact:!tw-pe-2";

  /**
   * Trailing edge padding is owned by the right-most non-empty slot. The content end slot owns it
   * only when the parent `bit-item`'s end slot is empty; otherwise that slot owns it.
   */
  protected readonly endSlotPaddingClass = computed(() =>
    this.item?.endSlotHasChildren() ? "" : `${this.sizePadding()} ${this.endSlotOverrides}`,
  );

  /** Main content owns the trailing padding only when both this end slot and the bit-item end slot are empty. */
  protected readonly mainContentPaddingClass = computed(() =>
    this.endSlotHasChildren() || this.item?.endSlotHasChildren()
      ? ""
      : `${this.sizePadding()} bit-compact:!tw-pe-2`,
  );

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
