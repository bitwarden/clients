import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  effect,
  inject,
  signal,
} from "@angular/core";

import { A11yGridDirective } from "../a11y/a11y-grid.directive";
import { A11yRowDirective } from "../a11y/a11y-row.directive";

import { ItemActionComponent } from "./item-action.component";

@Component({
  selector: "bit-item",
  standalone: true,
  imports: [ItemActionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "item.component.html",
  providers: [{ provide: A11yRowDirective, useExisting: ItemComponent }],
  host: {
    class:
      "tw-block tw-box-border tw-overflow-hidden tw-flex tw-bg-background [&:has([data-item-main-content]_button:hover,[data-item-main-content]_a:hover)]:tw-cursor-pointer [&:has([data-item-main-content]_button:hover,[data-item-main-content]_a:hover)]:tw-bg-primary-100 tw-text-main tw-border-solid tw-border-b tw-border-0 [&:not(bit-layout_*)]:tw-rounded-lg bit-compact:[&:not(bit-layout_*)]:tw-rounded-none bit-compact:[&:not(bit-layout_*)]:last-of-type:tw-rounded-b-lg bit-compact:[&:not(bit-layout_*)]:first-of-type:tw-rounded-t-lg tw-min-h-9 tw-mb-1.5 bit-compact:tw-mb-0",
  },
})
export class ItemComponent extends A11yRowDirective {
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

  private a11yGrid = inject(A11yGridDirective, { optional: true });
  private el = inject(ElementRef<HTMLElement>);

  constructor() {
    super();

    /** Workaround to reset internal component state when view is recycled during virtual scroll */
    effect(
      () => {
        if (this.a11yGrid && !this.el.nativeElement.contains(this.a11yGrid.focusTarget())) {
          this.focusVisibleWithin.set(false);
        }
      },
      { allowSignalWrites: true },
    );
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
