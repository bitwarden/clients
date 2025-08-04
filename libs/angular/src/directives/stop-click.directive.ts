import { Directive, HostListener } from "@angular/core";

@Directive({
  selector: "[appStopClick]",
  standalone: false,
})
export class StopClickDirective {
  @HostListener("click", ["$event"]) onClick($event: MouseEvent) {
    $event.preventDefault();
  }
}
