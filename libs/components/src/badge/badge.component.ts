import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from "@angular/core";

export type BadgeVariant =
  | "primary"
  | "subtle"
  | "success"
  | "danger"
  | "warning"
  | "accent-primary";

export type BadgeSize = "small" | "large";

const inactiveStyles = [
  "disabled:tw-bg-bg-disabled",
  "disabled:tw-border-border-base",
  "disabled:tw-text-fg-disabled",
  "disabled:hover:tw-bg-bg-disabled",
  "disabled:tw-pointer-events-none",
  "aria-disabled:tw-bg-bg-disabled",
  "aria-disabled:tw-border-border-base",
  "aria-disabled:tw-text-fg-disabled",
  "aria-disabled:hover:tw-bg-bg-disabled",
  "aria-disabled:tw-pointer-events-none",
];

const variantStyles: Record<BadgeVariant, string[]> = {
  primary: [
    "tw-bg-bg-brand-softer",
    "tw-border-border-brand-soft",
    "tw-text-fg-brand-strong",
    "[&:is(button,a)]:hover:tw-bg-bg-brand-soft",
    "[&:has(button:hover:not([bitChipDismissButton]),a:hover)]:tw-bg-bg-brand-soft",
  ],
  subtle: [
    "tw-bg-bg-primary",
    "tw-border-border-base",
    "tw-text-fg-body",
    "[&:is(button,a)]:hover:tw-bg-bg-quaternary",
    "[&:has(button:hover:not([bitChipDismissButton]),a:hover)]:tw-bg-bg-quaternary",
  ],
  success: [
    "tw-bg-bg-primary",
    "tw-border-border-base",
    "tw-text-fg-body",
    "[&:is(button,a)]:hover:tw-bg-bg-quaternary",
    "[&:has(button:hover:not([bitChipDismissButton]),a:hover)]:tw-bg-bg-quaternary",
  ],
  warning: [
    "tw-bg-bg-primary",
    "tw-border-border-base",
    "tw-text-fg-body",
    "[&:is(button,a)]:hover:tw-bg-bg-quaternary",
    "[&:has(button:hover:not([bitChipDismissButton]),a:hover)]:tw-bg-bg-quaternary",
  ],
  danger: [
    "tw-bg-bg-primary",
    "tw-border-border-base",
    "tw-text-fg-body",
    "[&:is(button,a)]:hover:tw-bg-bg-quaternary",
    "[&:has(button:hover:not([bitChipDismissButton]),a:hover)]:tw-bg-bg-quaternary",
  ],
  "accent-primary": [
    "tw-bg-bg-accent-primary-soft",
    "tw-border-border-accent-primary-soft",
    "tw-text-fg-accent-primary-strong",
    "[&:is(button,a)]:hover:tw-bg-bg-accent-primary-medium",
    "[&:has(button:hover:not([bitChipDismissButton]),a:hover)]:tw-bg-bg-accent-primary-medium",
  ],
};

// Size mappings
const sizeStyles: Record<BadgeSize, string[]> = {
  small: ["tw-text-xs", "tw-px-1.5", "tw-py-0.5"],
  large: ["tw-text-sm", "tw-px-2", "tw-py-1"],
};

const commonStyles = [
  "tw-inline-flex",
  "tw-items-center",
  "tw-rounded-full",
  "tw-border",
  "tw-font-medium",

  // Button-specific resets (when applied to button elements)
  "[&:is(button)]:tw-appearance-none",
  "[&:is(button)]:tw-outline-none",
  ...inactiveStyles,
  // "[&:is(button)]:tw-bg-transparent",
];

/**
 * Badges are primarily used as labels, counters, and small buttons.
 * Typically Badges are only used with text set to `text-xs`. If additional sizes are needed, the component configurations may be reviewed and adjusted.
 *
 * The Badge directive can be used on a `<span>` (non clickable events), or an `<a>` or `<button>` tag
 *
 * > `NOTE:` The Focus and Hover states only apply to badges used for interactive events.
 *
 * > `NOTE:` The `disabled` state only applies to buttons.
 */
@Component({
  selector: "span[bitBadge]",
  imports: [CommonModule],
  templateUrl: "badge.component.html",
  host: {
    "[class]": "classList()",
    "[attr.title]": "titleAttr()",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeComponent {
  private readonly el = inject(ElementRef<HTMLElement>);

  private readonly hasHoverEffects = this.el.nativeElement.nodeName !== "SPAN";

  /**
   * Optional override for the automatic badge title attribute when truncating.
   * When truncating is enabled and this is not provided, the badge will automatically
   * use its text content as the title.
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
   * Tailwind max-width class to apply when truncating is enabled.
   * Must be a valid Tailwind max-width utility class (e.g., "tw-max-w-40", "tw-max-w-xs").
   */
  readonly maxWidthClass = input<`tw-max-w-${string}`>("tw-max-w-40");

  protected readonly classList = computed(() => {
    return [...commonStyles, ...sizeStyles[this.size()], ...variantStyles[this.variant()]].concat(
      this.truncate() ? this.maxWidthClass() : [],
    );
  });

  protected readonly titleAttr = computed(() => {
    const title = this.title();
    if (title !== undefined) {
      return title;
    }
    return this.truncate() ? this.el.nativeElement?.textContent?.trim() : null;
  });

  getFocusTarget() {
    return this.el.nativeElement;
  }
}
