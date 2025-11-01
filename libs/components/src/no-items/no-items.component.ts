import { Component, input } from "@angular/core";

import { NoResults } from "@bitwarden/assets/svg";

import { BitIconComponent } from "../icon/icon.component";

/**
 * Component for displaying a message when there are no items to display. Expects title, description and button slots.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-no-items",
  templateUrl: "./no-items.component.html",
  imports: [BitIconComponent],
})
export class NoItemsComponent {
  readonly icon = input(NoResults);
}
