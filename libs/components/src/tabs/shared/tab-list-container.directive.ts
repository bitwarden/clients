import { Directive } from "@angular/core";

/**
 * Directive used for styling the container for bit tab labels
 */
@Directive({
  selector: "[bitTabListContainer]",
  host: {
    class: "tw-inline-flex tw-flex-wrap tw-leading-5",
  },
})
export class TabListContainerDirective {}
