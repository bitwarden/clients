import { ChangeDetectionStrategy, Component } from "@angular/core";

import { BaseCardDirective } from "./base-card/base-card.directive";
import { CardContentComponent } from "./card-content.component";

@Component({
  selector: "bit-marketing-card",
  templateUrl: "marketing-card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardContentComponent],
  host: {
    class: "!tw-border-border-brand-soft tw-relative tw-overflow-hidden",
  },
  hostDirectives: [BaseCardDirective],
})
export class MarketingCardComponent {}
