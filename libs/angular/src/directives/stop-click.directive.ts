import { Directive, HostListener } from "@angular/core";

@Directive({
  selector: "[appStopClick]",
})
export class StopClickDirective {
  @HostListener("click", ["$event"]) onClick($event: MouseEvent) {
    $event.preventDefault();
  }
}
