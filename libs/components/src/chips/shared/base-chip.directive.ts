import {
  Directive,
  ElementRef,
  booleanAttribute,
  computed,
  inject,
  input,
  model,
  signal,
} from "@angular/core";

import { AriaDisableDirective } from "../../a11y/aria-disable.directive";
import { ariaDisableElement } from "../../utils/aria-disable-element";

// Helper constants for Storybook and default values
export const CHIP_VARIANTS = ["primary", "subtle", "accent-primary", "accent-secondary"] as const;
export type ChipVariant = (typeof CHIP_VARIANTS)[number];

export const CHIP_SIZES = ["small", "large"] as const;
export type ChipSize = (typeof CHIP_SIZES)[number];

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
// Specific padding adjustments are handled in the component templates to account for the presence of the dismiss button or trailing icon, which have fixed sizes that impact the overall padding needed for visual consistency with design specifications.
const getSizeStyles = (size: ChipSize, hasTrailingIcon: boolean) => {
  const sizeStyles: Record<ChipSize, string[]> = {
    small: ["tw-text-xs/4", "tw-ps-1.5", "tw-py-[calc(theme(spacing[0.5])_-_1px)]"],
    large: ["tw-text-sm/5", "tw-ps-2", "tw-py-[calc(theme(spacing.1)_-_1px)]"],
  };

  const paddingEndClass = {
    hasTrailingIcon: {
      small: "tw-pe-0.5",
      large: "tw-pe-1",
    },
    noTrailingIcon: {
      small: "tw-pe-1.5",
      large: "tw-pe-2",
    },
  };

  const paddingKey = hasTrailingIcon ? "hasTrailingIcon" : "noTrailingIcon";
  const paddingClass = paddingEndClass[paddingKey][size];

  return [...sizeStyles[size], paddingClass];
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
  host: {
    "[class]": "classList()",
  },
  hostDirectives: [AriaDisableDirective],
})
export class BaseChipDirective {
  /**
   * Visual variant of the chip
   */
  readonly variant = model<ChipVariant>("primary");

  /**
   * Size of the chip
   */
  readonly size = input<ChipSize>("large");

  /**
   * Whether the chip is in selected state
   */
  readonly selected = input<boolean>(false);

  /** Internal selected state (programmatic control) - writable signal */
  readonly selectedState = signal(false);

  /** Combined selected state from both input and programmatic control */
  readonly isSelected = computed(() => this.selected() || this.selectedState());

  /** Chip will stretch to full width of its container */
  readonly fullWidth = input(false, { transform: booleanAttribute });

  /**
   * Tailwind max-width class to apply when truncating is enabled.
   * Must be a valid Tailwind max-width utility class (e.g., "tw-max-w-40", "tw-max-w-xs").
   */
  readonly maxWidthClass = input<`tw-max-w-${string}`>("tw-max-w-52");

  /** Disabled state from input (template binding) */
  protected readonly disabledInput = input(false, {
    alias: "disabled",
    transform: booleanAttribute,
  });

  /** Internal disabled state (programmatic control) - writable signal */
  readonly disabledState = signal(false);

  /** Combined disabled state from both input and programmatic control */
  readonly disabled = computed(() => this.disabledInput() || this.disabledState());

  /** Set to true by consuming components that render a trailing icon or dismiss button */
  readonly hasTrailingIcon = signal(false);

  /**
   * Computed class list based on variant, size, and state
   */
  protected readonly classList = computed(() => {
    const size = this.size() || "large";
    const classes = [
      ...commonStyles,
      ...getSizeStyles(size, this.hasTrailingIcon()),
      this.fullWidth() ? "tw-w-full" : this.maxWidthClass(),
    ];

    const currentVariant = this.variant() || "primary";

    if (this.isSelected()) {
      classes.push(...variantStyles["primary"]);
    } else {
      classes.push(...variantStyles[currentVariant]);
    }

    return classes.join(" ");
  });

  private el = inject(ElementRef<HTMLElement>);

  constructor() {
    ariaDisableElement(this.el.nativeElement, this.disabled);
  }
}
