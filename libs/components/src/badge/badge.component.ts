import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from "@angular/core";

import { IconComponent } from "../icon";
import { BitwardenIcon } from "../shared/icon";

/**
 * @deprecated Use 'primary' instead. This variant will be removed in a future version.
 */
export type LegacyInfoVariant = "info";

/**
 * @deprecated Use 'subtle' instead. This variant will be removed in a future version.
 */
export type LegacySecondaryVariant = "secondary";

export type BadgeVariant =
  | "primary"
  | "subtle"
  | "success"
  | "danger"
  | "warning"
  | "accent-primary"
  | LegacyInfoVariant
  | LegacySecondaryVariant;

export type BadgeSize = "small" | "large";

const variantStyles: Record<BadgeVariant, string[]> = {
  primary: ["tw-bg-bg-brand-softer", "tw-border-border-brand-soft", "tw-text-fg-brand-strong"],
  info: ["tw-bg-bg-brand-softer", "tw-border-border-brand-soft", "tw-text-fg-brand-strong"],
  subtle: ["tw-bg-bg-secondary", "tw-border-border-base", "tw-text-fg-body"],
  secondary: ["tw-bg-bg-secondary", "tw-border-border-base", "tw-text-fg-body"],
  success: ["tw-bg-bg-success-soft", "tw-border-border-success-soft", "tw-text-fg-success-strong"],
  warning: ["tw-bg-bg-warning-soft", "tw-border-border-warning-soft", "tw-text-fg-warning-strong"],
  danger: ["tw-bg-bg-danger-soft", "tw-border-border-danger-soft", "tw-text-fg-danger-strong"],
  "accent-primary": [
    "tw-bg-bg-accent-primary-soft",
    "tw-border-border-accent-primary-soft",
    "tw-text-fg-accent-primary-strong",
  ],
};

type SizeStyle = {
  label: string[];
  icon: string[];
};

// Size mappings
const sizeStyles: Record<BadgeSize, SizeStyle> = {
  small: {
    label: ["tw-text-xs/4", "tw-px-1", "tw-py-0.5"],
    icon: ["tw-text-sm/3"],
  },
  large: {
    label: ["tw-text-sm/5", "tw-px-1.5", "tw-py-1"],
    icon: ["tw-text-base/5"],
  },
};

const commonStyles = [
  "tw-inline-flex",
  "tw-items-center",
  "tw-rounded-full",
  "tw-border",
  "tw-font-medium",
  "tw-cursor-default",
];

const defaultIconMap: Record<BadgeVariant, BitwardenIcon | null> = {
  info: "bwi-info-circle",
  subtle: "bwi-info-circle",
  secondary: "bwi-info-circle",
  primary: "bwi-info-circle",
  success: "bwi-check-circle",
  warning: "bwi-exclamation-triangle",
  danger: "bwi-error",
  "accent-primary": null,
};

const getDefaultIconForVariant = (variant: BadgeVariant) => defaultIconMap[variant];

/**
 * Badges are used as labels.
 *
 * The Badge directive can only be used on a `<span>` tag
 */
@Component({
  selector: "span[bitBadge], bit-badge",
  imports: [IconComponent],
  templateUrl: "badge.component.html",
  host: {
    "[class]": "classList()",
    "[attr.title]": "titleContent()",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  private readonly el = inject(ElementRef<HTMLElement>);

  /**
   * Optional override for the tooltip content when content overflows.
   * When overflow is detected and this is not provided, the badge will automatically
   * use its text content as the tooltip.
   */
  readonly title = input<string>();

  /**
   * Visual variant that determines the badge's color scheme.
   */
  readonly variant = input<BadgeVariant>("primary");

  /**
   * Size of the badge, which determines its padding and font size.
   */
  readonly size = input<BadgeSize>("large");

  /**
   * Whether to truncate long text with ellipsis when it exceeds maxWidthClass.
   * When enabled, a title attribute is automatically added for accessibility.
   */
  readonly truncate = input(true);

  /**
   * Tailwind max-width class to apply to constrain badge width.
   * Must be a valid Tailwind max-width utility class (e.g., "tw-max-w-40", "tw-max-w-xs").
   */
  readonly maxWidthClass = input<`tw-max-w-${string}`>("tw-max-w-40");

  readonly startIcon = input<BitwardenIcon | null | undefined>(undefined);

  protected readonly computedIcon = computed(() => {
    if (this.startIcon() === null) {
      return null;
    }

    return this.startIcon() || getDefaultIconForVariant(this.variant());
  });

  protected readonly iconSizeStyles = computed(() => {
    return sizeStyles[this.size()]?.icon;
  });

  protected readonly classList = computed(() => {
    return [
      ...commonStyles,
      ...sizeStyles[this.size()].label,
      ...variantStyles[this.variant()],
    ].concat(this.truncate() ? this.maxWidthClass() : "");
  });

  /**
   * Computed title content - only shows when content is overflowing
   */
  protected readonly titleContent = computed(() => {
    // Use custom title if provided, otherwise use text content
    const customTitle = this.title();
    if (customTitle !== undefined) {
      return customTitle;
    }

    return this.truncate() ? this.el.nativeElement?.textContent?.trim() || "" : undefined;
  });
}
