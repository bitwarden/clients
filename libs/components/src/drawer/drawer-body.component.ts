import { CdkScrollable } from "@angular/cdk/scrolling";
import { ChangeDetectionStrategy, Component } from "@angular/core";

import { hasScrolledFrom } from "../utils/has-scrolled-from";

/**
 * Body container for `bit-drawer`
 */
@Component({
  selector: "bit-drawer-body",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  host: {
    class:
      "tw-p-4 tw-pt-0 tw-block tw-overflow-auto tw-border-solid tw-border tw-border-transparent tw-transition-colors tw-duration-200",
    "[class.tw-border-t-secondary-300]": "this.hasScrolledFrom().top",
  },
  hostDirectives: [
    {
      directive: CdkScrollable,
    },
  ],
  template: ` <ng-content></ng-content> `,
})
export class DrawerBodyComponent {
  protected hasScrolledFrom = hasScrolledFrom();
}
