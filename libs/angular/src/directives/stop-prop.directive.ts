import { Directive, HostListener } from "@angular/core";

@Directive({
  selector: "[appStopProp]",
})
export class StopPropDirective {
  @HostListener("click", ["$event"]) onClick($event: MouseEvent) {
    $event.stopPropagation();
  }
}
