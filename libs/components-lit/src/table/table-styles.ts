export type RowAlignment = "top" | "middle" | "bottom" | "baseline";

/**
 * Classes for a `<table>` styled like `bit-table`. Exported so a component rendering its own
 * table markup in its shadow root (which adopts the shared sheet) can match it.
 */
export function tableClasses(layout: "auto" | "fixed" = "auto"): string {
  return [
    "tw-w-full",
    "tw-leading-normal",
    "tw-text-main",
    "tw-border-collapse",
    "tw-text-start",
    layout === "auto" ? "tw-table-auto" : "tw-table-fixed",
  ].join(" ");
}

export const tableHeadClasses =
  "tw-border-0 tw-border-b-2 tw-border-solid tw-border-border-base tw-font-medium tw-text-muted";

const alignmentClasses: Record<RowAlignment, string> = {
  top: "tw-align-top",
  middle: "tw-align-middle",
  bottom: "tw-align-bottom",
  baseline: "tw-align-baseline",
};

/** Classes for a body `<tr>` (Angular `tr[bitRow]`). */
export function tableRowClasses(align: RowAlignment = "middle"): string {
  return [
    "tw-border-0",
    "tw-border-b",
    "tw-border-border-base",
    "tw-border-solid",
    "has-[input[type=checkbox]:hover]:tw-bg-bg-brand-softer",
    "has-[input[type=checkbox]:focus-visible]:tw-bg-bg-brand-softer",
    "has-[input[type=checkbox]:checked]:tw-bg-bg-brand-soft",
    // `bit-checkbox` keeps its input in its own shadow root; it reflects `checked` instead.
    "has-[bit-checkbox:hover]:tw-bg-bg-brand-softer",
    "has-[bit-checkbox[checked]]:tw-bg-bg-brand-soft",
    "last:tw-border-0",
    "tw-transition-colors",
    alignmentClasses[align] ?? alignmentClasses.baseline,
  ].join(" ");
}

/** Classes for a `<th>`/`<td>` (Angular `[bitCell]`). */
export const tableCellClasses = "tw-p-3 has-[bit-icon-button]:tw-py-1";

export const sortButtonClasses = [
  "tw-min-w-max",
  "tw-font-medium",

  // Below is copied from BitIconButtonComponent
  "tw-border",
  "tw-border-solid",
  "tw-rounded",
  "tw-transition",
  "hover:tw-no-underline",
  "focus:tw-outline-none",

  "tw-bg-transparent",
  "!tw-text-muted",
  "tw-border-transparent",
  "hover:tw-bg-transparent-hover",
  "hover:tw-border-primary-700",
  "focus-visible:before:tw-ring-primary-700",
  "disabled:tw-opacity-60",
  "disabled:hover:tw-border-transparent",
  "disabled:hover:tw-bg-transparent",

  // Workaround for box-shadow with transparent offset issue:
  // https://github.com/tailwindlabs/tailwindcss/issues/3595
  // Remove `before:` and use regular `tw-ring` when browser no longer has bug, or better:
  // switch to `outline` with `outline-offset` when Safari supports border radius on outline.
  // Using `box-shadow` to create outlines is a hack and as such `outline` should be preferred.
  "tw-relative",
  "before:tw-content-['']",
  "before:tw-block",
  "before:tw-absolute",
  "before:-tw-inset-[3px]",
  "before:tw-rounded-md",
  "before:tw-transition",
  "before:tw-ring",
  "before:tw-ring-transparent",
  "focus-visible:tw-z-10",
].join(" ");
