import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

/**
 * Arranges skeleton loaders into a pre-arranged group that mimics the table and item components.
 *
 * Pass skeleton loaders into the start, default, and end content slots. The content within each slot
 * is fully customizable.
 */
@Component({
  selector: "bit-skeleton-group",
  templateUrl: "./skeleton-group.component.html",
  imports: [CommonModule],
  host: {
    class: "tw-block",
  },
})
export class SkeletonGroupComponent {}
