import { Directive, HostBinding } from "@angular/core";

@Directive({
  selector: "th[bitCell], td[bitCell]",
  standalone: true,
})
export class CellDirective {
  @HostBinding("class") get classList() {
    return ["tw-p-3"];
  }
}
