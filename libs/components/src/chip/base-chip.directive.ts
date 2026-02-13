import { Directive, ElementRef, booleanAttribute, computed, inject, input } from "@angular/core";

import { AriaDisableDirective } from "../a11y/aria-disable.directive";
import { ariaDisableElement } from "../utils/aria-disable-element";

export const ChipVariants = {
  Primary: "primary",
  Subtle: "subtle",
  AccentPrimary: "accent-primary",
  AccentSecondary: "accent-secondary",
} as const;

export type ChipVariant = (typeof ChipVariants)[keyof typeof ChipVariants];

export const ChipSizes = {
  Small: "small",
  Large: "large",
} as const;

export type ChipSize = (typeof ChipSizes)[keyof typeof ChipSizes];

const focusRing = [
  "focus-visible:tw-ring-2",
  "focus-visible:tw-ring-offset-2",
  "focus-visible:tw-ring-border-focus",
  "focus-visible:tw-z-10",
  "[&:has(:focus-visible:not(button[bitChipDismissButton]))]:tw-ring-2",
  "[&:has(:focus-visible:not(button[bitChipDismissButton]))]:tw-ring-offset-2",
  "[&:has(:focus-visible:not(button[bitChipDismissButton]))]:tw-ring-border-focus",
  "[&:has(:focus-visible:not(button[bitChipDismissButton]))]:tw-z-10",
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
    "[&:has(button:hover:not([bitChipDismissButton]),a:hover)]:tw-bg-bg-brand-soft",
  ],
  subtle: [
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
  "accent-secondary": [
    "tw-bg-bg-accent-secondary-soft",
    "tw-border-border-accent-secondary-soft",
    "tw-text-fg-accent-secondary-strong",
    "[&:is(button,a)]:hover:tw-bg-bg-accent-secondary-medium",
    "[&:has(button:hover:not([bitChipDismissButton]),a:hover)]:tw-bg-bg-accent-secondary-medium",
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
  readonly variant = input<ChipVariant>(ChipVariants.Primary);

  /**
   * Size of the chip
   */
  readonly size = input<ChipSize>(ChipSizes.Large);

  /**
   * Whether the chip is in selected state
   */
  readonly selected = input<boolean>(false);

  /** Chip will stretch to full width of its container */
  readonly fullWidth = input(false, { transform: booleanAttribute });

  /** Disabled state of the chip */
  readonly disabled = input(false, { transform: booleanAttribute });

  /**
   * Computed class list based on variant, size, and state
   */
  protected readonly classList = computed(() => {
    const classes = [
      ...commonStyles,
      ...sizeStyles[this.size()],
      this.fullWidth() ? "tw-w-full" : "tw-max-w-52",
    ];

    if (this.selected()) {
      classes.push(...variantStyles[ChipVariants.Primary]);
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
