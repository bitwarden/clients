import { CommonModule } from "@angular/common";
import { Component, ElementRef, HostBinding, input } from "@angular/core";

import { FocusableElement } from "../shared/focusable-element";

export type BadgeVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "notification";

const styles: Record<BadgeVariant, string[]> = {
  primary: ["tw-bg-primary-100", "tw-border-primary-700", "!tw-text-primary-700"],
  secondary: ["tw-bg-secondary-100", "tw-border-secondary-700", "!tw-text-secondary-700"],
  success: ["tw-bg-success-100", "tw-border-success-700", "!tw-text-success-700"],
  danger: ["tw-bg-danger-100", "tw-border-danger-700", "!tw-text-danger-700"],
  warning: ["tw-bg-warning-100", "tw-border-warning-700", "!tw-text-warning-700"],
  info: ["tw-bg-info-100", "tw-border-info-700", "!tw-text-info-700"],
  notification: [
    "tw-bg-notification-100",
    "tw-border-notification-600",
    "!tw-text-notification-600",
  ],
};

const hoverStyles: Record<BadgeVariant, string[]> = {
  primary: ["hover:tw-bg-primary-600", "hover:tw-border-primary-600", "hover:!tw-text-contrast"],
  secondary: [
    "hover:tw-bg-secondary-600",
    "hover:tw-border-secondary-600",
    "hover:!tw-text-contrast",
  ],
  success: ["hover:tw-bg-success-600", "hover:tw-border-success-600", "hover:!tw-text-contrast"],
  danger: ["hover:tw-bg-danger-600", "hover:tw-border-danger-600", "hover:!tw-text-contrast"],
  warning: ["hover:tw-bg-warning-600", "hover:tw-border-warning-600", "hover:!tw-text-black"],
  info: ["hover:tw-bg-info-600", "hover:tw-border-info-600", "hover:!tw-text-black"],
  notification: [
    "hover:tw-bg-notification-600",
    "hover:tw-border-notification-600",
    "hover:!tw-text-contrast",
  ],
};
/**
  * Badges are primarily used as labels, counters, and small buttons.

  * Typically Badges are only used with text set to `text-xs`. If additional sizes are needed, the component configurations may be reviewed and adjusted.

  * The Badge directive can be used on a `<span>` (non clickable events), or an `<a>` or `<button>` tag

  * > `NOTE:` The Focus and Hover states only apply to badges used for interactive events.
  *
  * > `NOTE:` The `disabled` state only applies to buttons.
  *
*/
@Component({
  selector: "span[bitBadge], a[bitBadge], button[bitBadge]",
  providers: [{ provide: FocusableElement, useExisting: BadgeComponent }],
  imports: [CommonModule],
  templateUrl: "badge.component.html",
})
export class BadgeComponent implements FocusableElement {
  @HostBinding("class") get classList() {
    return [
      "tw-inline-block",
      "tw-py-1",
      "tw-px-2",
      "tw-font-medium",
      "tw-text-center",
      "tw-align-text-top",
      "tw-rounded-full",
      "tw-border-[0.5px]",
      "tw-border-solid",
      "tw-box-border",
      "tw-whitespace-nowrap",
      "tw-text-xs",
      "hover:tw-no-underline",
      "focus-visible:tw-outline-none",
      "focus-visible:tw-ring-2",
      "focus-visible:tw-ring-offset-2",
      "focus-visible:tw-ring-primary-600",
      "disabled:tw-bg-secondary-300",
      "disabled:hover:tw-bg-secondary-300",
      "disabled:tw-border-secondary-300",
      "disabled:hover:tw-border-secondary-300",
      "disabled:!tw-text-muted",
      "disabled:hover:!tw-text-muted",
      "disabled:tw-cursor-not-allowed",
    ]
      .concat(styles[this.variant()])
      .concat(this.hasHoverEffects ? [...hoverStyles[this.variant()], "tw-min-w-10"] : [])
      .concat(this.truncate() ? this.maxWidthClass() : []);
  }
  @HostBinding("attr.title") get titleAttr() {
    const title = this.title();
    if (title !== undefined) {
      return title;
    }
    return this.truncate() ? this?.el?.nativeElement?.textContent?.trim() : null;
  }

  /**
   * Optional override for the automatic badge title when truncating.
   */
  readonly title = input<string>();

  /**
   * Variant, sets the background color of the badge.
   */
  readonly variant = input<BadgeVariant>("primary");

  /**
   * Truncate long text
   */
  readonly truncate = input(true);

  readonly maxWidthClass = input<`tw-max-w-${string}`>("tw-max-w-40");

  getFocusTarget() {
    return this.el.nativeElement;
  }

  private hasHoverEffects = false;

  constructor(private el: ElementRef<HTMLElement>) {
    this.hasHoverEffects = el?.nativeElement?.nodeName != "SPAN";
  }
}
