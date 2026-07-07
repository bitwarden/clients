import { Component } from "@angular/core";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-card-content",
  template: `<div class="tw-p-4 [@media(min-width:650px)]:tw-p-6"><ng-content></ng-content></div>`,
})
export class CardContentComponent {}
