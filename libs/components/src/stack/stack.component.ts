import { Component, Input } from "@angular/core";

import { SharedModule } from "../shared";

@Component({
  selector: "bit-stack",
  templateUrl: "stack.component.html",
  standalone: true,
  imports: [SharedModule],
})
export class StackComponent {
  @Input() direction: "row" | "column" = "column";
}
