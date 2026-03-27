import { ChangeDetectionStrategy, Component, computed, input, output } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconComponent } from "../icon";
import { IconButtonModule } from "../icon-button";
import { ButtonType } from "../shared/button-like.abstraction";
import { BitwardenIcon } from "../shared/icon";
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
  imports: [I18nPipe, IconComponent, IconButtonModule, TypographyModule],
})
export class ToastComponent {
  /** Visual style indicating the nature of the notification. */
  readonly variant = input<ToastVariant>("info");

  /**
   * The message to display.
   *
   * @deprecated Passing an array to render multiple paragraphs is deprecated. Use a single string.
   **/
  readonly message = input.required<string | string[]>();

  /** @deprecated No longer displayed. */
  readonly title = input<string>();

  /** Emits when the user presses the close button */
  readonly onClose = output<void>();

  protected readonly styles = computed(() => toastStyles({ variant: this.variant() }));

  private static readonly iconNames: Record<ToastVariant, BitwardenIcon> = {
    success: "bwi-check-circle",
    error: "bwi-error",
    info: "bwi-info-circle",
    warning: "bwi-exclamation-triangle",
  };
  protected readonly iconName = computed(() => ToastComponent.iconNames[this.variant()]);

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
