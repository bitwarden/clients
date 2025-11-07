import { ChangeDetectionStrategy, Component } from "@angular/core";

import { BaseCardDirective } from "./base-card/base-card.directive";

@Component({
  selector: "bit-card",
  template: `<ng-content></ng-content>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-p-4 [@media(min-width:650px)]:tw-p-6",
  },
  hostDirectives: [BaseCardDirective],
})
export class CardComponent {}
