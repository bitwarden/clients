import { CommonModule } from "@angular/common";
import { Component, input } from "@angular/core";

/**
 * Basic skeleton loading component that can be used to represent content that is loading.
 * Use for layout-level elements and text, not for interactive elements.
 *
 * Customize the shape's edges with the `edgeShape` input. Customize the shape's size by
 * applying classes to the `bit-skeleton` element (i.e. `tw-w-40 tw-h-8`).
 *
 * If you're looking to represent lines of text, use the `bit-skeleton-text` helper component.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-skeleton",
  templateUrl: "./skeleton.component.html",
  imports: [CommonModule],
  host: {
    class: "tw-block",
  },
})
export class SkeletonComponent {
  /**
   * The shape of the corners of the skeleton element
   */
  readonly edgeShape = input<"box" | "circle">("box");
}
