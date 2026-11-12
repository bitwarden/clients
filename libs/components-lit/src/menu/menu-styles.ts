/**
 * Shared menu-item appearance (padding, rounding, focus ring, disabled states) without a `display`
 * utility, so it composes with `tw-block` or `tw-flex`. Exported so other menu-like components
 * (e.g. filter options) match `bit-menu-item` exactly. Use inside a shadow root.
 */
export const menuItemBaseStyles = [
  "tw-w-full",
  "tw-p-2",
  "tw-rounded-lg",
  "!tw-no-underline",
  "tw-cursor-pointer",
  "tw-border-none",
  "tw-bg-background",
  "tw-text-start",
  "focus-visible:tw-z-50",
  "focus-visible:tw-outline-none",
  "focus-visible:tw-ring-2",
  "focus-visible:tw-rounded-lg",
  "focus-visible:tw-ring-inset",
  "focus-visible:tw-ring-border-focus",
  "active:!tw-ring-0",
  "active:!tw-ring-offset-0",
  "disabled:hover:tw-bg-background",
  "disabled:tw-cursor-default",
  "disabled:!tw-text-fg-inactive",
  "aria-disabled:hover:tw-bg-background",
  "aria-disabled:tw-cursor-default",
  "aria-disabled:!tw-text-fg-inactive",
];

/** The default (primary) menu-item text/hover colors. */
export const menuItemPrimaryStyles = [
  "tw-text-fg-body",
  "hover:tw-text-fg-heading",
  "hover:tw-bg-bg-brand-softer",
  "focus-visible:tw-text-fg-heading",
  "focus-visible:tw-bg-bg-brand-softer",
];

export const menuItemDangerStyles = [
  "tw-text-fg-danger",
  "hover:tw-text-fg-danger-strong",
  "hover:tw-bg-bg-danger-soft",
  "focus-visible:tw-text-fg-danger-strong",
  "focus-visible:tw-bg-bg-danger-soft",
];

/**
 * Marks an element inside a `bit-menu` as closing the menu when it (or a descendant) is clicked.
 * `bit-menu-item` has it automatically; add it to other content, e.g. links in a `dialog`-role
 * menu. Replaces `bitMenuClose`.
 */
export const MENU_CLOSE_ATTRIBUTE = "data-bit-menu-close";

/** Elements the menu's keyboard navigation moves between. Custom items can opt in with the attribute. */
export const MENU_ITEM_SELECTOR = "bit-menu-item, [data-bit-menu-item]";
