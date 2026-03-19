import { Directive, HostListener, Input } from "@angular/core";

@Directive({
  selector: "[appTextDrag]",
  host: {
    draggable: "true",
    class: "tw-cursor-move",
  },
})
export class TextDragDirective {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({
    alias: "appTextDrag",
    required: true,
  })
  data = "";

  @HostListener("dragstart", ["$event"])
  onDragStart(event: DragEvent) {
    event.dataTransfer?.setData("text", this.data);
  }
}
