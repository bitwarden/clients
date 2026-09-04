import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";

import { ItemActionComponent } from "./item-action.component";
import { ItemGroupComponent } from "./item-group.component";

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
  private readonly itemGroup = inject(ItemGroupComponent, { optional: true });

  /** Whether this item is part of a `joined` (segmented-card) group. */
  protected readonly joined = computed(() => this.itemGroup?.joined() ?? false);

  /**
   * We have `:focus-within` and `:focus-visible` but no `:focus-visible-within`
   */
  protected readonly focusVisibleWithin = signal(false);

  protected readonly hostClasses = computed(() => {
    // When joined, the group's segmented card owns the border, radius, and dividers, so the
    // item drops its own border/radius/margin to avoid doubling up inside the card.
    const structural = this.joined()
      ? ""
      : "tw-border [&:not(bit-layout_*)]:tw-rounded-lg bit-compact:[&:not(bit-layout_*)]:tw-rounded-none bit-compact:[&:not(bit-layout_*)]:last-of-type:tw-rounded-b-lg bit-compact:[&:not(bit-layout_*)]:first-of-type:tw-rounded-t-lg tw-mb-1.5 bit-compact:tw-mb-0 bit-compact:[&+&]:tw-border-t-0";

    const focus = this.focusVisibleWithin()
      ? `tw-z-10 tw-rounded tw-outline-none tw-ring-1 tw-border-border-focus tw-ring-border-focus ${
          this.joined() ? "tw-ring-inset" : "bit-compact:tw-ring-inset bit-compact:tw-ring-2"
        }`
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
