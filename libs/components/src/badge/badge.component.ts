import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
} from "@angular/core";

import { IconComponent } from "../icon";
import { OverflowItemDirective } from "../overflow-list/overflow-item.directive";
import { BitwardenIcon } from "../shared/icon";
import { TooltipDirective } from "../tooltip/tooltip.directive";

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
  info: null,
  subtle: null,
  secondary: null,
  primary: null,
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
  hostDirectives: [
    // OverflowItemDirective is applied to every badge so wrappers like
    // `bit-badge-group` can let `bitOverflowList` measure and hide them. None
    // of its inputs/outputs are exposed — `pinned` is internal-only, set
    // programmatically by the wrapper.
    OverflowItemDirective,
    {
      directive: TooltipDirective,
      // Override the default badge tooltip content by providing content to [bitTooltip] directly
      inputs: ["tooltipPosition", "bitTooltip"],
    },
  ],

  templateUrl: "badge.component.html",
  host: {
    "[class]": "classList()",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tooltip = inject(TooltipDirective);

  constructor() {
    /**
     * Set the tooltip content to the badge's content, unless there is already custom tooltip
     * content provided by the consumer
     */
    effect(() => {
      const tooltipContent = this.tooltip.tooltipContent();
      if (tooltipContent.length > 0) {
        return;
      }

      const content = this.defaultTooltipContent();

      this.tooltip.tooltipContent.set(content);
    });
  }

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
   * When enabled, a tooltip with the full text is automatically shown.
   */
  readonly truncate = input(true);

  /**
   * Tailwind max-width class to apply to constrain badge content width.
   * Must be a valid Tailwind max-width utility class (e.g., "tw-max-w-40", "tw-max-w-xs").
   *
   * @default `tw-max-w-[calc(25ch_-_theme(spacing.2))]`
   * shows ~30ch when showing truncated text. Accounts for space taken up by ellipsis
   */
  readonly maxWidthClass = input<`tw-max-w-${string}`>("tw-max-w-[calc(25ch_-_theme(spacing.2))]");

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
    return [...commonStyles, ...sizeStyles[this.size()].label, ...variantStyles[this.variant()]];
  });

  protected readonly contentClasses = computed(() => [
    "tw-px-1",
    "tw-text-start",
    "tw-min-w-0",
    "tw-flex-1",
    ...(this.truncate() ? ["tw-truncate", this.maxWidthClass()] : []),
  ]);

  /**
   * The badge's HTML content as a string if the badge has the potential to truncate, to display
   * in the tooltip
   */
  protected readonly defaultTooltipContent = computed(() => {
    return this.truncate() ? this.el.nativeElement?.textContent?.trim() || "" : "";
  });
}
