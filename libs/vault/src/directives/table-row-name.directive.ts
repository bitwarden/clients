import { Directive } from "@angular/core";

/**
 * Styles a vault table row's name link or button as the row's plain-text title, per the "Primary
 * cell" design: heading colour, medium weight, no link colour or hover underline. The element stays
 * a real `<a>`/`<button>`, so it remains the row's keyboard and assistive-tech target.
 *
 * - The margin, padding, border, background and font resets are explicit because desktop runs
 *   Tailwind without preflight, where a `<button>` would otherwise keep its native look.
 * - `tw-min-w-0 tw-max-w-full tw-truncate` truncate the name as a flex child; `tw-text-base`'s 150%
 *   line height leaves descenders room inside the clipped box.
 * - The row already draws a focus ring around itself, so the focus-visible underline only marks
 *   which element in the row holds focus.
 * - The colour is `!important` because desktop's global stylesheet colours every anchor that isn't
 *   `bitLink`/`bitButton` (including on hover/focus) with a selector that outranks a utility class.
 */
@Directive({
  selector: "a[vaultTableRowName], button[vaultTableRowName]",
  host: {
    class:
      "tw-m-0 tw-p-0 tw-border-0 tw-bg-transparent tw-font-sans tw-text-base tw-font-medium !tw-text-fg-heading tw-text-start tw-no-underline tw-cursor-pointer tw-min-w-0 tw-max-w-full tw-truncate focus-visible:tw-outline-none focus-visible:tw-underline",
  },
})
export class TableRowNameDirective {}
