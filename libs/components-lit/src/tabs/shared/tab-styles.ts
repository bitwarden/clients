/** Gap between tab items in pixels. */
export const TAB_LIST_CONTAINER_GAP = 24;

/** Styling for the tab header/background shared by content and navigation tabs. */
export const TAB_HEADER_CLASSES =
  "tw-flex tw-items-end tw-border-0 tw-border-b tw-border-solid tw-border-border-base";

/**
 * Container for the tab labels. `tw-min-w-0` lets this row shrink below its content's intrinsic
 * min-width when it's a flex item next to siblings (e.g. the More button) — without it, default
 * `min-width: auto` would pin the row to its largest tab's natural width.
 */
export const TAB_LIST_CONTAINER_CLASSES =
  "tw-inline-flex tw-flex-nowrap tw-w-full tw-min-w-0 tw-leading-5";

/** Label content span inside a tab list item. */
export const TAB_LABEL_CONTENT_CLASSES =
  "tw-flex tw-items-center tw-gap-1.5 tw-h-6 tw-rounded group-focus-visible/tab-list-item:tw-ring-2 group-focus-visible/tab-list-item:tw-ring-border-focus";

const baseClasses = [
  "tw-block",
  "tw-relative",
  "tw-h-full",
  "tw-max-w-fit",
  "tw-whitespace-nowrap",
  "tw-pb-3",
  "tw-px-0",
  "tw-pt-0",
  "tw-border-0",
  "tw-text-sm",
  "tw-font-medium",
  "tw-bg-transparent",
  "tw-outline-none",
  "tw-no-underline",
  "tw-cursor-pointer",
  "tw-group/tab-list-item",
  "tw-transition",

  "after:tw-content-['']",
  "after:tw-w-full",
  "after:tw-h-[2px]",
  "after:tw-bg-bg-brand",
  "after:tw-absolute",
  "after:-tw-bottom-px",
  "after:tw-inset-x-0",
  "after:tw-transition-opacity",
  "after:tw-opacity-0",
];

/** Classes for a tab header item (content tab button, nav link, or the More button). */
export function tabListItemClasses({
  active = false,
  disabled = false,
}: {
  active?: boolean;
  disabled?: boolean;
}): string {
  return [
    ...baseClasses,
    ...(active ? ["tw-font-semibold", "after:tw-opacity-100"] : []),
    ...(disabled
      ? ["tw-cursor-default", "!tw-text-fg-inactive", "hover:!tw-text-fg-inactive"]
      : active
        ? ["!tw-text-fg-brand"]
        : ["!tw-text-fg-body", "hover:!tw-text-fg-brand"]),
  ].join(" ");
}
