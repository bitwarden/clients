import { Component, EventEmitter, Input, Output } from "@angular/core";

import { Icon, isIcon } from "../icon";
import { IconModule } from "../icon/icon.module";
import { IconButtonModule } from "../icon-button";
import { SharedModule } from "../shared";
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

@Component({
  selector: "bit-toast",
  templateUrl: "toast.component.html",
  standalone: true,
  imports: [SharedModule, IconButtonModule, TypographyModule, IconModule],
})
export class ToastComponent {
  /** The variant of the toast */
  @Input() variant: ToastVariant = "info";

  /**
   * The message to display
   *
   * Pass an array to render multiple paragraphs.
   **/
  @Input({ required: true })
  message!: string | string[];

  /** An optional title to display over the message. */
  @Input() title?: string;

  /**
   * The percent width of the progress bar, from 0-100
   **/
  @Input() progressWidth = 0;

  /** An optional icon that overrides the existing variant definition
   * string if you want to a use a font icon, or an Icon object if you want to use an SVG icon.
   */
  @Input() icon?: string | Icon;

  /** Emits when the user presses the close button */
  @Output() onClose = new EventEmitter<void>();

  /**
   * Checks if the provided icon is type of Icon and when that is true returns an Icon
   */
  protected isIcon(icon: unknown): icon is Icon {
    return isIcon(icon);
  }

  protected get iconClass(): string {
    if (typeof this.icon === "string" && this.icon !== "") {
      return this.icon;
    }
    return variants[this.variant].icon;
  }

  protected get bgColor(): string {
    return variants[this.variant].bgColor;
  }

  protected get messageArray(): string[] {
    return Array.isArray(this.message) ? this.message : [this.message];
  }
}
