import { ChangeDetectionStrategy, Component, effect, inject, input } from "@angular/core";

import { ToastComponent } from "./toast.component";
import { defaultToastConfig, ToastPosition, ToastService } from "./toast.service";

/**
 * Renders the toast stack and manages its position, enter/leave animations, and hover-pause
 * behaviour. Place once in the app root template: `<bit-toast-container></bit-toast-container>`.
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
  /** @see ToastConfig.autoDismiss */
  readonly autoDismiss = input(defaultToastConfig.autoDismiss);
  /** @see ToastConfig.timeout */
  readonly timeout = input(defaultToastConfig.timeout);
  /** @see ToastConfig.position */
  readonly position = input<ToastPosition>(defaultToastConfig.position);

  constructor() {
    effect(() => {
      this.service.configure({
        maxOpened: this.maxOpened(),
        autoDismiss: this.autoDismiss(),
        timeout: this.timeout(),
        position: this.position(),
      });
    });
  }
}
