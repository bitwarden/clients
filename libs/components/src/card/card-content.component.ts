import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "bit-card-content",
  template: `<div class="tw-p-4 [@media(min-width:769px)]:tw-p-6"><ng-content></ng-content></div>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardContentComponent {}
