import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule } from "../icon-button";
import { TypographyModule } from "../typography";

export type ToastVariant = "success" | "error" | "info" | "warning";

const variants: Record<ToastVariant, { icon: string; bgColor: string }> = {
  success: {
    icon: "bwi-check-circle",
    bgColor: "tw-bg-success-100",
  },
  error: {
    icon: "bwi-error",
    bgColor: "tw-bg-danger-100",
  },
  info: {
    icon: "bwi-info-circle",
    bgColor: "tw-bg-info-100",
  },
  warning: {
    icon: "bwi-exclamation-triangle",
    bgColor: "tw-bg-warning-100",
  },
};

/**
 * Displays a single toast notification with a variant icon, title, message, and close button.
 * Intended to be rendered by `ToastContainerComponent` — not placed directly in app templates.
 */
@Component({
  selector: "bit-toast",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "toast.component.html",
  imports: [I18nPipe, IconButtonModule, TypographyModule],
})
export class ToastComponent {
  /** Visual style indicating the nature of the notification. */
  readonly variant = input<ToastVariant>("info");

  /**
   * The message to display
   *
   * Pass an array to render multiple paragraphs.
   **/
  readonly message = input.required<string | string[]>();

  /** An optional title to display over the message. */
  readonly title = input<string>();

  /** Emits when the user presses the close button */
  readonly onClose = output<void>();

  protected readonly iconClass = computed(() => variants[this.variant()].icon);
  protected readonly bgColor = computed(() => variants[this.variant()].bgColor);
  protected readonly messageArray = computed(() => {
    const message = this.message();
    return Array.isArray(message) ? message : [message];
  });
}
