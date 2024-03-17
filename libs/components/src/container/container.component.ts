import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

/**
 * Generic container that constrains page content width.
 */
@Component({
  selector: "bit-container",
  templateUrl: "container.component.html",
  imports: [CommonModule],
  standalone: true,
})
export class ContainerComponent {}
