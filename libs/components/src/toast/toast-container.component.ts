import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";

import containerStyles from "./toast-container.component.styles";
import { ToastComponent } from "./toast.component";
import { ToastService } from "./toast.service";

/**
 * Renders the toast stack and manages its position, enter/leave animations, and hover-pause
 * behaviour. Typically placed inside a layout component (`bit-layout`, `bit-landing-layout`,
 * `popup-tab-navigation`) so the layout can control positioning relative to its own chrome
 * (drawers, tab bars, etc.).
 *
 * Position is responsive: full-width at the bottom on narrow screens, bottom-right on wider
 * screens (≥ `sm` breakpoint).
 */
@Component({
  selector: "bit-toast-container",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToastComponent],
  templateUrl: "toast-container.component.html",
})
export class ToastContainerComponent {
  protected readonly service = inject(ToastService);

  /**
   * Overrides the inline-end offset (CSS `right`) for the bottom-right position on wider screens.
   * Accepts any CSS length (e.g. `"24rem"`, `"calc(400px + 1rem)"`).
   * Defaults to `1rem` when not set.
   */
  readonly endOffset = input<string | null>(null);

  /**
   * Overrides the bottom offset.
   * Useful for layouts with a bottom chrome (e.g. a tab bar) that toasts should clear.
   * Accepts any CSS length. Defaults to `1rem` when not set.
   */
  readonly bottomOffset = input<string | null>(null);

  protected readonly styles = containerStyles();
}
