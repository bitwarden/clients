import { Directive, HostListener, Input } from "@angular/core";

@Directive({
  selector: "[appTextDrag]",
  standalone: true,
  host: {
    draggable: "true",
    class: "tw-cursor-move",
  },
})
export class TextDragDirective {
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
