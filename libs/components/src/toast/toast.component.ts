import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule } from "../icon-button";
import { ButtonType } from "../shared/button-like.abstraction";
import { TypographyModule } from "../typography";

import toastStyles from "./toast.component.styles";

export type ToastVariant = "success" | "error" | "info" | "warning";

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

  /** @deprecated No longer displayed. */
  readonly title = input<string>();

  /** Emits when the user presses the close button */
  readonly onClose = output<void>();

  protected readonly styles = computed(() => toastStyles({ variant: this.variant() }));

  private static readonly closeButtonTypes: Record<ToastVariant, ButtonType> = {
    success: "successGhost",
    error: "dangerGhost",
    warning: "warningGhost",
    info: "primaryGhost",
  };
  protected readonly closeButtonType = computed(
    () => ToastComponent.closeButtonTypes[this.variant()],
  );
  protected readonly messageArray = computed(() => {
    const message = this.message();
    return Array.isArray(message) ? message : [message];
  });
}
