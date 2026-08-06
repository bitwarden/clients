import {
  AfterContentChecked,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  signal,
  viewChild,
} from "@angular/core";

import { ItemActionComponent } from "./item-action.component";

export type ItemSize = "base" | "lg";

@Component({
  selector: "bit-item",
  imports: [ItemActionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "item.component.html",
  host: {
    "[class]": "hostClasses()",
    "(focusin)": "onFocusIn($event.target)",
    "(focusout)": "onFocusOut()",
  },
})
export class ItemComponent implements AfterContentChecked {
  readonly size = input<ItemSize>("base");

  readonly endSlot = viewChild<ElementRef<HTMLDivElement>>("endSlot");

  /** Public so `bit-item-content` can yield its trailing padding when this slot is populated. */
  readonly endSlotHasChildren = signal(false);

  /** The bit-item end slot is always right-most when present, so it always owns trailing padding. */
  protected readonly endSlotPaddingClass = computed(() =>
    this.size() === "lg" ? "tw-pe-4" : "tw-pe-3",
  );

  /**
   * We have `:focus-within` and `:focus-visible` but no `:focus-visible-within`
   */
  protected readonly focusVisibleWithin = signal(false);

  protected readonly hostClasses = computed(() => {
    const base =
      "tw-flex tw-rounded-lg tw-ps-3 tw-gap-3 tw-justify-between tw-overflow-hidden tw-bg-bg-primary [&:has([data-item-main-content]_button:hover,[data-item-main-content]_a:hover)]:tw-cursor-pointer [&:has([data-item-main-content]_button:enabled:hover,[data-item-main-content]_a:hover,[data-item-main-content]_button:enabled:focus-visible,[data-item-main-content]_a:focus-visible)]:tw-bg-bg-brand-softer tw-text-fg-heading tw-border-solid tw-border-border-base tw-min-h-9";

    const structural =
      "tw-border bit-compact:tw-rounded-none bit-compact:last-of-type:tw-rounded-b-lg bit-compact:first-of-type:tw-rounded-t-lg tw-mb-1.5 bit-compact:tw-mb-0 bit-compact:[&+&]:tw-border-t-0";

    const focus = this.focusVisibleWithin()
      ? "tw-z-10 tw-outline-none tw-ring-1 tw-border-border-focus tw-ring-border-focus bit-compact:tw-ring-inset bit-compact:tw-ring-2"
      : "";

    return `${base} ${structural} ${focus}`.trim();
  });

  ngAfterContentChecked(): void {
    this.endSlotHasChildren.set((this.endSlot()?.nativeElement.childElementCount ?? 0) > 0);
  }

  protected onFocusIn(target: EventTarget) {
    this.focusVisibleWithin.set((target as HTMLElement).matches("[data-fvw-target]:focus-visible"));
  }

  protected onFocusOut() {
    this.focusVisibleWithin.set(false);
  }
}
