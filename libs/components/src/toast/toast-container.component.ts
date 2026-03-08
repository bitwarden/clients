import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from "@angular/core";

import containerStyles from "./toast-container.component.styles";
import { ToastComponent } from "./toast.component";
import { defaultToastConfig, ToastPosition, ToastService } from "./toast.service";

/**
 * Renders the toast stack and manages its position, enter/leave animations, and hover-pause
 * behaviour. Typically placed inside a layout component (`bit-layout`, `bit-landing-layout`,
 * `popup-tab-navigation`) so the layout can control positioning relative to its own chrome
 * (drawers, tab bars, etc.).
 */
@Component({
  selector: "bit-toast-container",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ToastComponent],
  templateUrl: "toast-container.component.html",
})
export class ToastContainerComponent {
  protected readonly service = inject(ToastService);

  /** @see ToastConfig.maxOpened */
  readonly maxOpened = input(defaultToastConfig.maxOpened);
  /** @see ToastConfig.timeout */
  readonly timeout = input(defaultToastConfig.timeout);
  /** @see ToastConfig.position */
  readonly position = input<ToastPosition>(defaultToastConfig.position);

  protected readonly styles = computed(() => containerStyles({ position: this.position() }));

  constructor() {
    effect(() => {
      this.service.configure({
        maxOpened: this.maxOpened(),
        timeout: this.timeout(),
        position: this.position(),
      });
    });
  }
}
