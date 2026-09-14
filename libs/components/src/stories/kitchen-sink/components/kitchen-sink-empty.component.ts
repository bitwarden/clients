import { ChangeDetectionStrategy, Component } from "@angular/core";

import { NoFolders } from "@bitwarden/assets/svg";

import { KitchenSinkSharedModule } from "../kitchen-sink-shared.module";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "bit-kitchen-sink-empty",
  imports: [KitchenSinkSharedModule],
  template: `
    <div class="tw-flex tw-items-center tw-justify-center tw-min-h-96 tw-flex-col">
      <h2 bitTypography="h2">A Page with Content</h2>
      <bit-status-lockup>
        <bit-svg slot="graphic" [content]="emptySvg" />
        <ng-container slot="title">No items to display</ng-container>
        <ng-container slot="description">
          This is an example of an empty state using the bit-status-lockup component.
        </ng-container>
      </bit-status-lockup>
    </div>
  `,
})
export class KitchenSinkEmptyComponent {
  readonly emptySvg = NoFolders;
}
