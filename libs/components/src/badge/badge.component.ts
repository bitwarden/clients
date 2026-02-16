import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  NgZone,
  OnDestroy,
  signal,
  viewChild,
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
  secondary: ["tw-bg-bg-primary", "tw-border-border-base", "tw-text-fg-body"],
  success: ["tw-bg-bg-success-soft", "tw-border-border-success-soft", "tw-text-fg-success-strong"],
  warning: ["tw-bg-bg-warning-soft", "tw-border-border-warning-soft", "tw-text-fg-warning-strong"],
  danger: ["tw-bg-bg-danger-soft", "tw-border-border-danger-soft", "tw-text-fg-danger-strong"],
  "accent-primary": [
    "tw-bg-bg-accent-primary-soft",
    "tw-border-border-accent-primary-soft",
    "tw-text-fg-accent-primary-strong",
  ],
};

// Size mappings
const sizeStyles: Record<BadgeSize, string[]> = {
  small: ["tw-text-xs/4", "tw-px-1", "tw-py-0.5"],
  large: ["tw-text-sm/5", "tw-px-1.5", "tw-py-1"],
};

const commonStyles = [
  "tw-inline-flex",
  "tw-items-center",
  "tw-rounded-full",
  "tw-border",
  "tw-font-medium",
  "tw-cursor-default",
];

/**
 * Badges are primarily used as labels, counters, and small buttons.
 *
 * The Badge directive can only be used on a `<span>` tag
 *
 */
@Component({
  selector: "span[bitBadge]",
  imports: [IconComponent],
  templateUrl: "badge.component.html",
  hostDirectives: [TooltipDirective],
  host: {
    "[class]": "classList()",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent implements OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly tooltipDirective = inject(TooltipDirective);
  private readonly zone = inject(NgZone);

  /**
   * Reference to the text container element for overflow detection
   */
  private readonly textContainer = viewChild<ElementRef<HTMLElement>>("textContainer");

  /**
   * Signal tracking whether the badge content is overflowing
   */
  private readonly hasOverflow = signal(false);

  /**
   * ResizeObserver instance for detecting content changes
   */
  private resizeObserver?: ResizeObserver;

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
   * @deprecated This input is no longer used. Truncation is now automatic based on content overflow.
   * The input remains for backwards compatibility but has no effect.
   */
  readonly truncate = input(true);

  /**
   * Tailwind max-width class to apply to constrain badge width.
   * Must be a valid Tailwind max-width utility class (e.g., "tw-max-w-40", "tw-max-w-xs").
   */
  readonly maxWidthClass = input<`tw-max-w-${string}`>("tw-max-w-40");

  readonly startIcon = input<BitwardenIcon>();

  constructor() {
    // Set up overflow detection after initial render
    afterNextRender(() => {
      this.checkOverflow();
      this.setupResizeObserver();
    });

    // Update tooltip content when overflow state or title changes
    effect(() => {
      this.tooltipDirective.tooltipContent.set(this.tooltipContent());
    });
  }

  protected readonly classList = computed(() => {
    return [...commonStyles, ...sizeStyles[this.size()], ...variantStyles[this.variant()]].concat(
      this.maxWidthClass(),
    );
  });

  /**
   * Computed tooltip content - only shows when content is overflowing
   */
  protected readonly tooltipContent = computed(() => {
    if (!this.hasOverflow()) {
      return "";
    }

    // Use custom title if provided, otherwise use text content
    const customTitle = this.title();
    if (customTitle !== undefined) {
      return customTitle;
    }

    return this.el.nativeElement?.textContent?.trim() || "";
  });

  /**
   * Check if text content is overflowing the container
   */
  private checkOverflow() {
    const containerRef = this.textContainer();
    if (!containerRef) {
      return;
    }

    const container = containerRef.nativeElement;
    // Compare scrollWidth with clientWidth to detect horizontal overflow
    const isOverflowing = container.scrollWidth > container.clientWidth;

    // Only re-enter zone and trigger change detection if state actually changed
    if (isOverflowing !== this.hasOverflow()) {
      this.zone.run(() => {
        this.hasOverflow.set(isOverflowing);
      });
    }
  }

  /**
   * Set up ResizeObserver to detect content changes
   * Runs outside Angular zone to prevent automatic change detection.
   * We manually trigger CD only when overflow state changes.
   * Pattern follows table-scroll.component.ts
   */
  private setupResizeObserver() {
    const containerRef = this.textContainer();
    if (!containerRef) {
      return;
    }

    const container = containerRef.nativeElement;
    // Run observer outside Angular zone to prevent automatic CD
    this.zone.runOutsideAngular(() => {
      this.resizeObserver = new ResizeObserver(() => {
        this.checkOverflow();
      });

      this.resizeObserver.observe(container);
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  getFocusTarget() {
    return this.el.nativeElement;
  }
}
