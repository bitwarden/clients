import { Directive, HostBinding } from "@angular/core";

/**
 * Directive for styling table cells with consistent padding.
 */
@Directive({
  selector: "th[bitCell], td[bitCell]",
})
export class CellDirective {
  @HostBinding("class") get classList() {
    return ["tw-p-3", "has-[[biticonbutton]]:tw-py-1"];
  }
}
