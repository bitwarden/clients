import { Directive } from "@angular/core";

/**
 * Directive used for styling the container for bit tab labels
 */
@Directive({
  selector: "[bitTabListContainer]",
  host: {
    class: "tw-inline-flex tw-flex-nowrap tw-w-full tw-leading-5 tw-gap-6",
  },
})
export class TabListContainerDirective {}
