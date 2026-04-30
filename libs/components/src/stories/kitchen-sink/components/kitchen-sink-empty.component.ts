import { ChangeDetectionStrategy, Component } from "@angular/core";

import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "bit-kitchen-sink-empty",
  imports: [KitchenSinkSharedModule],
  template: `
    <div class="tw-flex tw-items-center tw-justify-center tw-min-h-96 tw-flex-col">
      <h2 bitTypography="h2">A Page with Content</h2>
      <bit-no-items>
        <ng-container slot="icon">
          <bit-icon name="bwi-grid" aria-hidden="true"></bit-icon>
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
