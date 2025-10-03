import { CommonModule } from "@angular/common";
import { Component, input } from "@angular/core";

@Component({
  selector: "bit-skeleton",
  templateUrl: "./skeleton.component.html",
  imports: [CommonModule],
  host: {
    class: "tw-block",
  },
})
export class SkeletonComponent {
  edgeShape = input<"box" | "circle">("box");
}
