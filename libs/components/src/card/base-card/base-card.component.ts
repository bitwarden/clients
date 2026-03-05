import { Component } from "@angular/core";

import { BaseCardDirective } from "./base-card.directive";

/**
 * The base card component is a container that applies our standard card border and box-shadow.
 * In most cases using our `<bit-card>` component should suffice.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-base-card",
  template: `<ng-content></ng-content>`,
  hostDirectives: [BaseCardDirective],
})
export class BaseCardComponent {}
