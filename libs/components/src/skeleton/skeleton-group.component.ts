import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

/**
 * Arranges skeleton loaders into a pre-arranged group that mimics the table and item components.
 *
 * Pass skeleton loaders into the start, default, and end content slots. The content within each slot
 * is fully customizable.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-skeleton-group",
  templateUrl: "./skeleton-group.component.html",
  imports: [CommonModule],
  host: {
    class: "tw-block",
  },
})
export class SkeletonGroupComponent {}
