import { CommonModule } from "@angular/common";
import { Component, computed, input } from "@angular/core";

import { SkeletonComponent } from "./skeleton.component";

/**
 * Specific skeleton component used to represent lines of text. It uses the `bit-skeleton`
 * under the hood.
 *
 * Customize the number of lines represented with the `lines` input. Customize the width
 * by applying a class to the `bit-skeleton-text` element (i.e. `tw-w-1/2`).
 */
@Component({
  selector: "bit-skeleton-text",
  templateUrl: "./skeleton-text.component.html",
  imports: [CommonModule, SkeletonComponent],
  host: {
    class: "tw-block",
  },
})
export class SkeletonTextComponent {
  /**
   * The number of text lines to display
   */
  readonly lines = input<number>(1);

  /**
   * Array-transformed version of the `lines` to loop over
   */
  protected linesArray = computed(() => [...Array(this.lines()).keys()]);
}
