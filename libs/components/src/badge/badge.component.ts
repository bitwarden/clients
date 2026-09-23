import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
} from "@angular/core";

import { IconComponent } from "../icon";
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
    {
      directive: TooltipDirective,
      // Override the default badge tooltip content by providing content to [bitTooltip] directly
      inputs: ["tooltipPosition", "bitTooltip", "addTooltipToDescribedby"],
    },
  ],

  templateUrl: "badge.component.html",
  host: {
    "[class]": "classList()",
    // The badge's text is projected content, so it can change without any signal this component
    // reads changing. Resolve it on the events that show the tooltip rather than caching it.
    "(mouseenter)": "syncDefaultTooltipContent()",
    "(focusin)": "syncDefaultTooltipContent()",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly tooltip = inject(TooltipDirective);

  /**
   * The tooltip content this badge last generated from its own text, used to tell content the
   * badge owns apart from content the consumer supplied via `[bitTooltip]`.
   */
  private readonly autoTooltipContent = signal("");

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
   * Point the tooltip at the badge's current text, so a truncated badge shows its full value.
   * Content the consumer provided via `[bitTooltip]` always wins and is never overwritten.
   */
  protected syncDefaultTooltipContent() {
    const currentContent = this.tooltip.tooltipContent();

    if (currentContent.length > 0 && currentContent !== this.autoTooltipContent()) {
      return;
    }

    const content = this.truncate() ? this.el.nativeElement?.textContent?.trim() || "" : "";

    this.autoTooltipContent.set(content);
    this.tooltip.tooltipContent.set(content);
  }
}
