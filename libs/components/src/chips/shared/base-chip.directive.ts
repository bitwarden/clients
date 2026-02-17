import { Directive, ElementRef, booleanAttribute, computed, inject, input } from "@angular/core";

import { AriaDisableDirective } from "../../a11y/aria-disable.directive";
import { ariaDisableElement } from "../../utils/aria-disable-element";

export type ChipVariant = "primary" | "subtle" | "accent-primary" | "accent-secondary";

export type ChipSize = "small" | "large";

// Helper constants for Storybook and default values
export const CHIP_VARIANTS: ChipVariant[] = [
  "primary",
  "subtle",
  "accent-primary",
  "accent-secondary",
];
export const CHIP_SIZES: ChipSize[] = ["small", "large"];

const focusRing = [
  "focus-visible:tw-ring-2",
  "focus-visible:tw-ring-offset-2",
  "focus-visible:tw-ring-border-focus",
  "focus-visible:tw-z-10",
  "[&:has(:focus-visible:not(button[bit-chip-dismiss-button]))]:tw-ring-2",
  "[&:has(:focus-visible:not(button[bit-chip-dismiss-button]))]:tw-ring-offset-2",
  "[&:has(:focus-visible:not(button[bit-chip-dismiss-button]))]:tw-ring-border-focus",
  "[&:has(:focus-visible:not(button[bit-chip-dismiss-button]))]:tw-z-10",
];

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

// Variant color mappings using design token system
const variantStyles: Record<ChipVariant, string[]> = {
  primary: [
    "tw-bg-bg-brand-softer",
    "tw-border-border-brand-soft",
    "tw-text-fg-brand-strong",
    "[&:is(button,a)]:hover:tw-bg-bg-brand-soft",
    "[&:has(button:hover:not([bit-chip-dismiss-button]),a:hover)]:tw-bg-bg-brand-soft",
  ],
  subtle: [
    "tw-bg-bg-primary",
    "tw-border-border-base",
    "tw-text-fg-body",
    "[&:is(button,a)]:hover:tw-bg-bg-quaternary",
    "[&:has(button:hover:not([bit-chip-dismiss-button]),a:hover)]:tw-bg-bg-quaternary",
  ],
  "accent-primary": [
    "tw-bg-bg-accent-primary-soft",
    "tw-border-border-accent-primary-soft",
    "tw-text-fg-accent-primary-strong",
    "[&:is(button,a)]:hover:tw-bg-bg-accent-primary-medium",
    "[&:has(button:hover:not([bit-chip-dismiss-button]),a:hover)]:tw-bg-bg-accent-primary-medium",
  ],
  "accent-secondary": [
    "tw-bg-bg-accent-secondary-soft",
    "tw-border-border-accent-secondary-soft",
    "tw-text-fg-accent-secondary-strong",
    "[&:is(button,a)]:hover:tw-bg-bg-accent-secondary-medium",
    "[&:has(button:hover:not([bit-chip-dismiss-button]),a:hover)]:tw-bg-bg-accent-secondary-medium",
  ],
};

// Size mappings
const sizeStyles: Record<ChipSize, string[]> = {
  small: ["tw-text-xs", "tw-px-1.5", "tw-py-0.5"],
  large: ["tw-text-sm", "tw-px-2", "tw-py-1"],
};

const commonStyles = [
  "tw-inline-flex",
  "tw-items-center",
  "tw-rounded-md",
  "tw-border",
  "tw-font-medium",
  "tw-transition-colors",

  // Button-specific resets (when applied to button elements)
  "[&:is(button)]:tw-appearance-none",
  "[&:is(button)]:tw-outline-none",
  ...focusRing,
  ...inactiveStyles,
];
/**
 * Provides base styling and behavior for chip components, including variant and size options, disabled state handling, and accessibility features.
 * @internal only to be used within lib/components
 */
@Directive({
  selector: "[bitBaseChip]",
  standalone: true,
  host: {
    "[class]": "classList()",
  },
  hostDirectives: [AriaDisableDirective],
})
export class BaseChipDirective {
  /**
   * Visual variant of the chip
   */
  readonly variant = input<ChipVariant>("primary");

  /**
   * Size of the chip
   */
  readonly size = input<ChipSize>("large");

  /**
   * Whether the chip is in selected state
   */
  readonly selected = input<boolean>(false);

  /** Chip will stretch to full width of its container */
  readonly fullWidth = input(false, { transform: booleanAttribute });

  /**
   * Tailwind max-width class to apply when truncating is enabled.
   * Must be a valid Tailwind max-width utility class (e.g., "tw-max-w-40", "tw-max-w-xs").
   */
  readonly maxWidthClass = input<`tw-max-w-${string}`>("tw-max-w-52");

  /** Disabled state of the chip */
  readonly disabled = input(false, { transform: booleanAttribute });

  /**
   * Computed class list based on variant, size, and state
   */
  protected readonly classList = computed(() => {
    const classes = [
      ...commonStyles,
      ...sizeStyles[this.size() || "large"],
      this.fullWidth() ? "tw-w-full" : this.maxWidthClass(),
    ];

    if (this.selected()) {
      classes.push(...variantStyles["primary"]);
    } else {
      classes.push(...variantStyles[this.variant()]);
    }

    return classes.join(" ");
  });

  private el = inject(ElementRef<HTMLElement>);

  constructor() {
    ariaDisableElement(this.el.nativeElement, this.disabled);
  }
}
