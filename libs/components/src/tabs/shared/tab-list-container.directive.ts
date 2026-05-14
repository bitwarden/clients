import { Directive } from "@angular/core";

/** Gap between tab items in pixels */
export const TAB_LIST_CONTAINER_GAP = 24;

/**
 * Directive used for styling the container for bit tab labels
 */
@Directive({
  selector: "[bitTabListContainer]",
  host: {
    class: "tw-inline-flex tw-flex-nowrap tw-w-full tw-leading-5",
    "[style.gap.px]": "gap",
  },
})
export class TabListContainerDirective {
  protected readonly gap = TAB_LIST_CONTAINER_GAP;
}
