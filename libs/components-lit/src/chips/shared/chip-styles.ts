// "filter" is a unique deprecated variant for the filter chip
export const CHIP_VARIANTS = [
  "primary",
  "subtle",
  "accent-primary",
  "accent-secondary",
  "filter",
] as const;
export type ChipVariant = (typeof CHIP_VARIANTS)[number];

export const CHIP_SIZES = ["small", "large"] as const;
export type ChipSize = (typeof CHIP_SIZES)[number];

const focusRing = [
  "focus-visible:tw-ring-2",
  "focus-visible:tw-ring-offset-2",
  "focus-visible:tw-ring-border-focus",
  "focus-visible:tw-z-10",
  "has-[:focus-visible:not([bit-chip-dismiss-button])]:tw-ring-2",
  "has-[:focus-visible:not([bit-chip-dismiss-button])]:tw-ring-offset-2",
  "has-[:focus-visible:not([bit-chip-dismiss-button])]:tw-ring-border-focus",
  "has-[:focus-visible:not([bit-chip-dismiss-button])]:tw-z-10",
];

const inactiveStyles = [
  "disabled:tw-bg-bg-inactive",
  "disabled:tw-border-border-base",
  "disabled:tw-text-fg-inactive",
  "disabled:hover:tw-bg-bg-inactive",
  "disabled:tw-pointer-events-none",
  "aria-disabled:!tw-bg-bg-inactive",
  "aria-disabled:tw-border-border-base",
  "aria-disabled:tw-text-fg-inactive",
  "aria-disabled:tw-pointer-events-none",
];

const variantStyles: Record<ChipVariant, string[]> = {
  primary: [
    "tw-bg-bg-brand-softer",
    "tw-border-border-brand-soft",
    "tw-text-fg-brand-strong",
    "[&:is(button,a)]:hover:tw-bg-bg-brand-soft",
    "[&:is(button,a)]:focus-visible:tw-bg-bg-brand-soft",
    "has-[button:hover:not([bit-chip-dismiss-button])]:tw-bg-bg-brand-soft",
    "has-[a:hover]:tw-bg-bg-brand-soft",
    "has-[button:focus-visible:not([bit-chip-dismiss-button])]:tw-bg-bg-brand-soft",
    "has-[a:focus-visible]:tw-bg-bg-brand-soft",
    "has-[[aria-expanded=true]]:tw-bg-bg-brand-soft",
  ],
  subtle: [
    "tw-bg-bg-secondary",
    "tw-border-border-base",
    "tw-text-fg-body",
    "[&:is(button,a)]:hover:tw-bg-bg-quaternary",
    "[&:is(button,a)]:focus-visible:tw-bg-bg-quaternary",
    "has-[button:hover:not([bit-chip-dismiss-button])]:tw-bg-bg-quaternary",
    "has-[a:hover]:tw-bg-bg-quaternary",
    "has-[button:focus-visible:not([bit-chip-dismiss-button])]:tw-bg-bg-quaternary",
    "has-[a:focus-visible]:tw-bg-bg-quaternary",
  ],
  // deprecated -- remove with filter chip variant
  filter: [
    "tw-bg-bg-primary",
    "tw-border-border-base",
    "tw-text-fg-body",
    "[&:is(button,a)]:hover:tw-bg-bg-quaternary",
    "[&:is(button,a)]:focus-visible:tw-bg-bg-quaternary",
    "has-[button:hover:not([bit-chip-dismiss-button])]:tw-bg-bg-quaternary",
    "has-[a:hover]:tw-bg-bg-quaternary",
    "has-[button:focus-visible:not([bit-chip-dismiss-button])]:tw-bg-bg-quaternary",
    "has-[a:focus-visible]:tw-bg-bg-quaternary",
    "has-[[aria-expanded=true]]:tw-bg-bg-quaternary",
  ],
  "accent-primary": [
    "tw-bg-bg-accent-primary-soft",
    "tw-border-border-accent-primary-soft",
    "tw-text-fg-accent-primary-strong",
    "[&:is(button,a)]:hover:tw-bg-bg-accent-primary-medium",
    "[&:is(button,a)]:focus-visible:tw-bg-bg-accent-primary-medium",
    "has-[button:hover:not([bit-chip-dismiss-button])]:tw-bg-bg-accent-primary-medium",
    "has-[a:hover]:tw-bg-bg-accent-primary-medium",
    "has-[button:focus-visible:not([bit-chip-dismiss-button])]:tw-bg-bg-accent-primary-medium",
    "has-[a:focus-visible]:tw-bg-bg-accent-primary-medium",
    "has-[[aria-expanded=true]]:tw-bg-bg-accent-primary-medium",
  ],
  "accent-secondary": [
    "tw-bg-bg-accent-secondary-soft",
    "tw-border-border-accent-secondary-soft",
    "tw-text-fg-accent-secondary-strong",
    "[&:is(button,a)]:hover:tw-bg-bg-accent-secondary-medium",
    "[&:is(button,a)]:focus-visible:tw-bg-bg-accent-secondary-medium",
    "has-[button:hover:not([bit-chip-dismiss-button])]:tw-bg-bg-accent-secondary-medium",
    "has-[a:hover]:tw-bg-bg-accent-secondary-medium",
    "has-[button:focus-visible:not([bit-chip-dismiss-button])]:tw-bg-bg-accent-secondary-medium",
    "has-[a:focus-visible]:tw-bg-bg-accent-secondary-medium",
    "has-[[aria-expanded=true]]:tw-bg-bg-accent-secondary-medium",
  ],
};

// Padding-end depends on whether a dismiss button or trailing icon is present, since those have
// fixed sizes that would otherwise throw off the visual balance.
const sizeStyles: Record<ChipSize, string[]> = {
  small: ["tw-text-xs/4", "tw-ps-1.5", "tw-py-[calc(theme(spacing[0.5])_-_1px)]"],
  large: ["tw-text-sm/5", "tw-ps-2", "tw-py-[calc(theme(spacing.1)_-_1px)]"],
};

const paddingEnd: Record<"trailing" | "none", Record<ChipSize, string>> = {
  trailing: { small: "tw-pe-0.5", large: "tw-pe-1" },
  none: { small: "tw-pe-1.5", large: "tw-pe-2" },
};

const commonStyles = [
  "tw-inline-flex",
  "tw-items-center",
  "tw-rounded-md",
  "tw-border",
  "tw-border-solid",
  "tw-font-medium",
  "tw-transition-colors",
  "tw-min-w-0",
  "tw-max-w-full",
  "[&:is(button)]:tw-appearance-none",
  "[&:is(button)]:tw-outline-none",
  "!tw-no-underline",
  ...focusRing,
  ...inactiveStyles,
];

export type ChipStyleOptions = {
  variant?: ChipVariant;
  size?: ChipSize;
  /** Selected chips render with the `primary` variant. */
  selected?: boolean;
  fullWidth?: boolean;
  /** Set when a trailing icon or dismiss button is rendered. */
  hasTrailingIcon?: boolean;
};

/**
 * Classes for the chip's box (Angular `BaseChipDirective`). Apply them to the chip's own button or
 * link, or to a wrapper containing its buttons, so the `has-[...]` and `[&:is(button,a)]` states
 * resolve the same way they do in `libs/components`.
 *
 * @internal
 */
export function chipClasses({
  variant = "primary",
  size = "large",
  selected = false,
  fullWidth = false,
  hasTrailingIcon = false,
}: ChipStyleOptions): string {
  return [
    ...commonStyles,
    ...sizeStyles[size],
    paddingEnd[hasTrailingIcon ? "trailing" : "none"][size],
    ...(fullWidth ? ["tw-w-full"] : []),
    ...variantStyles[selected ? "primary" : variant],
  ].join(" ");
}

/**
 * Host styles shared by chip elements. The max width defaults to Angular's `tw-max-w-52` and is
 * overridable with `--bit-chip-max-width` (Angular `maxWidthClass`).
 *
 * @internal
 */
export const chipHostCss = `
  :host {
    display: inline-flex;
    vertical-align: middle;
    min-width: 0;
    max-width: var(--bit-chip-max-width, 13rem);
  }
  :host([full-width]) {
    display: flex;
    width: 100%;
    max-width: 100%;
  }
  :host([hidden]) {
    display: none;
  }
`;

/** Host classes the interaction-state stories use to pin hover/focus styles on the inner control. */
export function testStateClasses(host: HTMLElement): string {
  return ["tw-test-hover", "tw-test-focus-visible"]
    .filter((name) => host.classList.contains(name))
    .join(" ");
}
