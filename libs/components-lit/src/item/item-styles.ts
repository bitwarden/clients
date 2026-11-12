import { createContext } from "@lit/context";
import { css } from "lit";

export type ItemSize = "base" | "lg";

/**
 * Padding per `size`, keyed by edge. Shared with `bit-item-content` so the two components can never
 * drift apart. Spelled out rather than composed from a scale, since Tailwind only emits classes it
 * can find as complete strings.
 */
export const ITEM_PADDING: Record<ItemSize, Record<"leading" | "trailing" | "vertical", string>> = {
  base: { leading: "tw-ps-3", trailing: "tw-pe-3", vertical: "tw-py-2" },
  lg: { leading: "tw-ps-4", trailing: "tw-pe-4", vertical: "tw-py-3" },
};

/** Icon buttons and compact mode tighten the trailing edge regardless of `size`. */
export function endSlotPaddingClasses(size: ItemSize, endsWithIconButton: boolean): string {
  return `${endsWithIconButton ? "tw-pe-2" : ITEM_PADDING[size].trailing} bit-compact:!tw-pe-2`;
}

export type ItemContextValue = {
  size: ItemSize;
  /** True when the `bit-item` end slot has content; `bit-item-content` then yields its trailing padding. */
  endSlotHasChildren: boolean;
};

export const itemContext = createContext<ItemContextValue>(Symbol("bit-item"));

export const itemGroupContext = createContext<true>(Symbol("bit-item-group"));

const ICON_BUTTON = "bit-icon-button";
// Links stay at 8px even when rendered as a button.
const BUTTONISH = "bit-button, bit-badge, bit-chip, bit-chip-action, button:not([data-link])";

/**
 * End slot children get a margin on both sides, keyed by content type: 8px for text and links, 4px
 * for buttons, badges and chips, 0 for icon buttons. Margins never collapse, so the space between
 * two neighbors is the sum of the two. The outer edges belong to the parent flex `gap` and the
 * slot's own `pe-*`, so the first and last child drop theirs.
 *
 * Content is classified by what it contains, however deeply wrapped, so the tiers are applied as
 * attributes rather than with `:has()` (which `::slotted()` doesn't allow).
 *
 * Returns whether the last child is (or wraps) an icon button.
 */
export function classifyEndSlot(elements: readonly Element[]): boolean {
  const kind = (el: Element) => {
    if (el.matches(ICON_BUTTON) || el.querySelector(ICON_BUTTON)) {
      return "0";
    }
    if (el.matches(BUTTONISH) || el.querySelector(BUTTONISH)) {
      return "1";
    }
    return "2";
  };
  elements.forEach((el, i) => {
    el.setAttribute("data-bit-end-gutter", kind(el));
    const edges = [i === 0 ? "first" : "", i === elements.length - 1 ? "last" : ""];
    el.setAttribute("data-bit-end-edge", edges.join(" ").trim());
  });
  const last = elements[elements.length - 1];
  return !!last && last.getAttribute("data-bit-end-gutter") === "0";
}

export const endSlotStyles = css`
  [data-bit-item-end-slot] ::slotted(*) {
    margin-inline: 0.5rem;
  }
  [data-bit-item-end-slot] ::slotted([data-bit-end-gutter="1"]) {
    margin-inline: 0.25rem;
  }
  [data-bit-item-end-slot] ::slotted([data-bit-end-gutter="0"]) {
    margin-inline: 0;
  }
  [data-bit-item-end-slot] ::slotted([data-bit-end-edge~="first"]) {
    margin-inline-start: 0;
  }
  [data-bit-item-end-slot] ::slotted([data-bit-end-edge~="last"]) {
    margin-inline-end: 0;
  }
`;
