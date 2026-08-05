import { ChangeDetectionStrategy, Component, computed, signal } from "@angular/core";

import { ItemActionComponent } from "./item-action.component";

@Component({
  selector: "bit-item",
  imports: [ItemActionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "item.component.html",
  host: {
    class:
      "tw-flex tw-gap-3 tw-justify-between tw-overflow-hidden tw-bg-bg-primary [&:has([data-item-main-content]_button:hover,[data-item-main-content]_a:hover)]:tw-cursor-pointer [&:has([data-item-main-content]_button:enabled:hover,[data-item-main-content]_a:hover,[data-item-main-content]_button:enabled:focus-visible,[data-item-main-content]_a:focus-visible)]:tw-bg-bg-brand-softer tw-text-fg-heading tw-border-solid tw-border-border-base tw-min-h-9",
    "[class]": "hostClasses()",
    "(focusin)": "onFocusIn($event.target)",
    "(focusout)": "onFocusOut()",
  },
})
export class ItemComponent {
  /**
   * We have `:focus-within` and `:focus-visible` but no `:focus-visible-within`
   */
  protected readonly focusVisibleWithin = signal(false);

  protected readonly hostClasses = computed(() => {
    const structural =
      "tw-border [&:not(bit-layout_*)]:tw-rounded-lg bit-compact:[&:not(bit-layout_*)]:tw-rounded-none bit-compact:[&:not(bit-layout_*)]:last-of-type:tw-rounded-b-lg bit-compact:[&:not(bit-layout_*)]:first-of-type:tw-rounded-t-lg tw-mb-1.5 bit-compact:tw-mb-0 bit-compact:[&+&]:tw-border-t-0";

    const focus = this.focusVisibleWithin()
      ? "tw-z-10 tw-rounded tw-outline-none tw-ring-1 tw-border-border-focus tw-ring-border-focus bit-compact:tw-ring-inset bit-compact:tw-ring-2"
      : "";

    return `${structural} ${focus}`.trim();
  });

  protected onFocusIn(target: EventTarget) {
    this.focusVisibleWithin.set((target as HTMLElement).matches("[data-fvw-target]:focus-visible"));
  }

  protected onFocusOut() {
    this.focusVisibleWithin.set(false);
  }
}
