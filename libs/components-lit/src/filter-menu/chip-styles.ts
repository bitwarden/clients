import { css } from "lit";

/** @internal */
export type FilterChipSize = "small" | "large";

const focusRing = [
  "has-[:focus-visible:not([data-chip-dismiss])]:tw-ring-2",
  "has-[:focus-visible:not([data-chip-dismiss])]:tw-ring-offset-2",
  "has-[:focus-visible:not([data-chip-dismiss])]:tw-ring-border-focus",
  "has-[:focus-visible:not([data-chip-dismiss])]:tw-z-10",
];

const inactive = [
  "!tw-bg-bg-inactive",
  "!tw-border-border-base",
  "!tw-text-fg-inactive",
  "tw-pointer-events-none",
];

const primary = [
  "tw-bg-bg-brand-softer",
  "tw-border-border-brand-soft",
  "tw-text-fg-brand-strong",
  "has-[button:hover:not([data-chip-dismiss])]:tw-bg-bg-brand-soft",
  "has-[button:focus-visible:not([data-chip-dismiss])]:tw-bg-bg-brand-soft",
  "has-[[aria-expanded=true]]:tw-bg-bg-brand-soft",
];

const subtle = [
  "tw-bg-bg-secondary",
  "tw-border-border-base",
  "tw-text-fg-body",
  "has-[button:hover:not([data-chip-dismiss])]:tw-bg-bg-quaternary",
  "has-[button:focus-visible:not([data-chip-dismiss])]:tw-bg-bg-quaternary",
];

const sizes: Record<FilterChipSize, string[]> = {
  small: ["tw-text-xs/4"],
  large: ["tw-text-sm/5"],
};

const paddingEnd: Record<FilterChipSize, { trailing: string; none: string }> = {
  small: { trailing: "tw-pe-0.5", none: "tw-pe-1.5" },
  large: { trailing: "tw-pe-1", none: "tw-pe-2" },
};

/**
 * The chip box classes for `bit-filter-menu` / `bit-filter-toggle` — the subtle chip variant,
 * drawn as primary while selected (Angular `bitBaseChip`). The trigger button carries the start and
 * vertical padding, so a menu anchors to the chip's edges.
 *
 * @internal
 */
export function filterChipClasses(o: {
  size: FilterChipSize;
  selected: boolean;
  disabled: boolean;
  trailingIcon: boolean;
}): string {
  return [
    "chip",
    "tw-inline-flex",
    "tw-items-center",
    "tw-rounded-md",
    "tw-border",
    "tw-border-solid",
    "tw-font-medium",
    "tw-transition-colors",
    "tw-min-w-0",
    ...focusRing,
    ...sizes[o.size],
    o.trailingIcon ? paddingEnd[o.size].trailing : paddingEnd[o.size].none,
    ...(o.selected ? primary : subtle),
    ...(o.disabled ? inactive : []),
  ].join(" ");
}

/** Start/vertical padding for the trigger button. */
export const triggerPadding: Record<FilterChipSize, string> = {
  small: "tw-ps-1.5 tw-py-0.5",
  large: "tw-ps-2 tw-py-1",
};

/** `bit-chip-content`'s layout for the trigger button. */
export const triggerClasses =
  "tw-inline-flex tw-min-w-0 tw-w-full tw-max-w-full tw-items-center tw-justify-between tw-gap-1.5 tw-truncate tw-border-none tw-bg-transparent tw-text-[length:inherit] tw-text-[color:inherit] tw-outline-none hover:tw-bg-transparent tw-cursor-pointer -tw-my-px";

/** Angular `bit-chip-dismiss-button` (large). */
export const dismissButtonClasses =
  "tw-bg-transparent hover:tw-bg-bg-hover focus-visible:tw-bg-bg-hover tw-outline-none tw-rounded-md tw-p-0.5 tw-text-[color:inherit] tw-text-[length:inherit] tw-border-solid tw-border tw-border-transparent tw-flex tw-items-center tw-justify-center focus-visible:tw-ring-2 tw-ring-border-focus hover:aria-disabled:tw-bg-transparent focus-visible:aria-disabled:tw-bg-transparent tw-text-sm tw-size-5 tw-cursor-pointer aria-disabled:tw-cursor-not-allowed";

/** Host sizing shared by the chips. `--bit-filter-chip-max-width` replaces `maxWidthClass`. */
export const filterChipHostStyles = css`
  :host {
    display: inline-flex;
    vertical-align: middle;
    max-width: 100%;
    min-width: 0;
  }
  :host([full-width]) {
    display: flex;
  }
  .chip {
    max-width: var(--bit-filter-chip-max-width, 13rem);
  }
  :host([full-width]) .chip {
    width: 100%;
    max-width: none;
  }
`;
