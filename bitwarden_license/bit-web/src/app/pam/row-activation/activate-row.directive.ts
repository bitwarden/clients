import { Directive } from "@angular/core";

import { isRowActivationClick } from "@bitwarden/vault";

/** Marks the control a click on its row's empty space activates. */
const ROW_ACTIVATOR_ATTRIBUTE = "data-pam-row-activator";

/** Forwards a click on a row's empty space to the `data-pam-row-activator` control in that row. */
@Directive({
  selector: "[pamActivateRow]",
  host: {
    class: "[&_bit-row:has([data-pam-row-activator])]:tw-cursor-pointer",
    "(click)": "onClick($event)",
  },
})
export class PamActivateRowDirective {
  protected onClick(event: MouseEvent) {
    if (!isRowActivationClick(event) || !(event.target instanceof Element)) {
      return;
    }

    event.target
      .closest("bit-row")
      ?.querySelector<HTMLElement>(`[${ROW_ACTIVATOR_ATTRIBUTE}]`)
      ?.click();
  }
}
