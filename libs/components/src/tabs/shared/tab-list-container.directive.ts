import { Directive } from "@angular/core";

/** Gap between tab items in pixels */
export const TAB_LIST_CONTAINER_GAP = 24;

/**
 * Directive used for styling the container for bit tab labels
 */
@Directive({
  selector: "[bitTabListContainer]",
  host: {
    // tw-min-w-0 lets this row shrink below its content's intrinsic min-width when it's
    // a flex item next to siblings (e.g., the More button) — without it, default
    // `min-width: auto` would pin the row to its largest tab's natural width.
    class: "tw-inline-flex tw-flex-nowrap tw-w-full tw-min-w-0 tw-leading-5",
  },
})
export class TabListContainerDirective {}
