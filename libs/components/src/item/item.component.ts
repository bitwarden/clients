import {
  ChangeDetectionStrategy,
  Component,
  HostBinding,
  HostListener,
  signal,
} from "@angular/core";

import { ItemActionComponent } from "./item-action.component";

@Component({
  selector: "bit-item",
  imports: [ItemActionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "item.component.html",
  host: {
    class:
      "tw-block tw-box-border tw-overflow-hidden tw-flex tw-bg-background [&:has([data-item-main-content]_button:hover,[data-item-main-content]_a:hover)]:tw-cursor-pointer [&:has([data-item-main-content]_button:enabled:hover,[data-item-main-content]_a:hover)]:tw-bg-hover-default tw-text-main tw-border-solid tw-border-b tw-border-0 [&:not(bit-layout_*)]:tw-rounded-lg bit-compact:[&:not(bit-layout_*)]:tw-rounded-none bit-compact:[&:not(bit-layout_*)]:last-of-type:tw-rounded-b-lg bit-compact:[&:not(bit-layout_*)]:first-of-type:tw-rounded-t-lg tw-min-h-9 tw-mb-1.5 bit-compact:tw-mb-0",
  },
})
export class ItemComponent {
  /**
   * We have `:focus-within` and `:focus-visible` but no `:focus-visible-within`
   */
  protected focusVisibleWithin = signal(false);
  @HostListener("focusin", ["$event.target"])
  onFocusIn(target: HTMLElement) {
    this.focusVisibleWithin.set(target.matches("[data-fvw-target]:focus-visible"));
  }
  @HostListener("focusout")
  onFocusOut() {
    this.focusVisibleWithin.set(false);
  }

  @HostBinding("class") get classList(): string[] {
    return [
      this.focusVisibleWithin()
        ? "tw-z-10 tw-rounded tw-outline-none tw-ring-2 bit-compact:tw-ring-inset tw-ring-primary-600 tw-border-transparent".split(
            " ",
          )
        : "tw-border-b-shadow",
    ].flat();
  }
}
