import { html, nothing, TemplateResult } from "lit";

import "../../icon/icon";
import { BitwardenIcon } from "../../icon/shared-icon";

import { ChipSize } from "./chip-styles";

export type ChipContentOptions = {
  size?: ChipSize;
  startIcon?: BitwardenIcon | null;
  endIcon?: BitwardenIcon | null;
  /** Rendered after the label, e.g. a dismiss button (Angular's `slot="end"`). */
  end?: TemplateResult | typeof nothing;
  /** Extra classes for the wrapper. */
  classes?: string;
};

/**
 * Chip layout: start icon, truncating label, end icon and trailing content (Angular
 * `bit-chip-content`).
 *
 * @internal
 */
export function renderChipContent(
  label: unknown,
  { size = "large", startIcon, endIcon, end = nothing, classes = "" }: ChipContentOptions,
) {
  const gap = size === "large" ? "tw-gap-1.5" : "tw-gap-1";
  return html`<span
    class="tw-inline-flex tw-min-w-0 tw-w-full tw-max-w-full tw-items-center tw-justify-between ${gap} ${classes}"
  >
    ${startIcon ? html`<bit-icon name=${startIcon} class="tw-text-base/5"></bit-icon>` : nothing}
    <span class="tw-text-start tw-truncate tw-leading-5 tw-min-w-0 tw-flex-1">${label}</span>
    ${endIcon ? html`<bit-icon name=${endIcon} class="tw-text-base/5"></bit-icon>` : nothing} ${end}
  </span>`;
}

const dismissBase = [
  "tw-bg-transparent",
  "hover:tw-bg-bg-hover",
  "focus-visible:tw-bg-bg-hover",
  "tw-outline-none",
  "tw-rounded-md",
  "tw-p-0.5",
  "tw-text-[color:inherit]",
  "tw-text-[length:inherit]",
  "tw-border-solid",
  "tw-border",
  "tw-border-transparent",
  "tw-flex",
  "tw-shrink-0",
  "tw-items-center",
  "tw-justify-center",
  "tw-cursor-pointer",
  "focus-visible:tw-ring-2",
  "tw-ring-border-focus",
  "hover:aria-disabled:tw-bg-transparent",
  "focus-visible:aria-disabled:tw-bg-transparent",
  "aria-disabled:tw-cursor-not-allowed",
].join(" ");

export type DismissButtonOptions = {
  label: string;
  size?: ChipSize;
  disabled?: boolean;
  onClick: (event: MouseEvent) => void;
  /** Extra classes, e.g. `tw-test-hover` for interaction-state stories. */
  classes?: string;
};

/**
 * Close button inside a chip (Angular `button[bit-chip-dismiss-button]`). Disabled with
 * `aria-disabled` so it stays focusable; clicks are ignored while disabled.
 *
 * @internal
 */
export function renderDismissButton({
  label,
  size = "large",
  disabled = false,
  onClick,
  classes = "",
}: DismissButtonOptions) {
  const sizeClasses = size === "small" ? "tw-text-xs tw-size-4" : "tw-text-sm tw-size-5";
  return html`<button
    bit-chip-dismiss-button
    type="button"
    class="${dismissBase} ${sizeClasses} ${classes}"
    aria-label=${label}
    aria-disabled=${disabled ? "true" : nothing}
    @click=${(event: MouseEvent) => {
      event.stopPropagation();
      if (!disabled) {
        onClick(event);
      }
    }}
  >
    <bit-icon name="bwi-close"></bit-icon>
  </button>`;
}
