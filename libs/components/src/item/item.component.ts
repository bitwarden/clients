import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, HostListener, signal } from "@angular/core";

import { A11yRowDirective } from "../a11y/a11y-row.directive";

import { ItemActionComponent } from "./item-action.component";

/**
 * The class used to set the height of a bit item's inner content.
 */
export const BitItemHeightClass = `tw-h-[52px]`;

/**
 * The height of a bit item in pixels. Includes any margin, padding, or border. Used by the virtual scroll
 * to estimate how many items can be displayed at once and how large the virtual container should be.
 * Needs to be updated if the item height or spacing changes.
 *
 * 52px + 6px bottom margin + 1px border = 59px
 */
export const BitItemHeight = 59;

@Component({
  selector: "bit-item",
  standalone: true,
  imports: [CommonModule, ItemActionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "item.component.html",
  providers: [{ provide: A11yRowDirective, useExisting: ItemComponent }],
})
export class ItemComponent extends A11yRowDirective {
  /**
   * We have `:focus-within` and `:focus-visible` but no `:focus-visible-within`
   */
  protected focusVisibleWithin = signal(false);
  @HostListener("focusin", ["$event.target"])
  onFocusIn(target: HTMLElement) {
    this.focusVisibleWithin.set(target.matches(".fvw-target:focus-visible"));
  }
  @HostListener("focusout")
  onFocusOut() {
    this.focusVisibleWithin.set(false);
  }
}
