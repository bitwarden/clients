// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, ElementRef, HostBinding, Input } from "@angular/core";

import { FocusableElement } from "../shared/focusable-element";

export type BadgeVariant = "primary" | "secondary" | "success" | "danger" | "warning" | "info";

const styles: Record<BadgeVariant, string[]> = {
  primary: ["tw-bg-primary-100", "tw-border-primary-700", "!tw-text-primary-700"],
  secondary: ["tw-bg-secondary-100", "tw-border-secondary-700", "!tw-text-secondary-700"],
  success: ["tw-bg-success-100", "tw-border-success-700", "!tw-text-success-700"],
  danger: ["tw-bg-danger-100", "tw-border-danger-700", "!tw-text-danger-700"],
  warning: ["tw-bg-warning-100", "tw-border-warning-700", "!tw-text-warning-700"],
  info: ["tw-bg-info-100", "tw-border-info-700", "!tw-text-info-700"],
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
};

@Component({
  selector: "span[bitBadge], a[bitBadge], button[bitBadge]",
  providers: [{ provide: FocusableElement, useExisting: BadgeComponent }],
  imports: [CommonModule],
  templateUrl: "badge.component.html",
  standalone: true,
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
      .concat(styles[this.variant])
      .concat(this.hasHoverEffects ? [...hoverStyles[this.variant], "tw-min-w-10"] : [])
      .concat(this.truncate ? this.maxWidthClass : []);
  }
  @HostBinding("attr.title") get titleAttr() {
    if (this.title !== undefined) {
      return this.title;
    }
    return this.truncate ? this.el.nativeElement.textContent.trim() : null;
  }

  /**
   * Optional override for the automatic badge title when truncating.
   */
  @Input() title?: string;

  /**
   * Variant, sets the background color of the badge.
   */
  @Input() variant: BadgeVariant = "primary";

  /**
   * Truncate long text
   */
  @Input() truncate = true;

  @Input() maxWidthClass: `tw-max-w-${string}` = "tw-max-w-40";

  getFocusTarget() {
    return this.el.nativeElement;
  }

  private hasHoverEffects = false;

  constructor(private el: ElementRef<HTMLElement>) {
    this.hasHoverEffects = el?.nativeElement?.nodeName != "SPAN";
  }
}
