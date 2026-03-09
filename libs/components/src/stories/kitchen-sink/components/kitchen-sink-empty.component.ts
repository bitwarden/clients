import { Component } from "@angular/core";

import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-kitchen-sink-empty",
  imports: [KitchenSinkSharedModule],
  template: `
    <div class="tw-flex tw-items-center tw-justify-center tw-min-h-96">
      <bit-no-items>
        <ng-container slot="icon">
          <bit-icon name="bwi-filter" aria-hidden="true"></bit-icon>
        </ng-container>
        <ng-container slot="title">No items to display</ng-container>
        <ng-container slot="description">
          This is an example of an empty state using the bit-no-items component.
        </ng-container>
      </bit-no-items>
    </div>
  `,
})
export class KitchenSinkEmptyComponent {}
