import { ChangeDetectionStrategy, Component } from "@angular/core";

import { BaseCardComponent } from "../card";

@Component({
  selector: "bit-landing-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [BaseCardComponent],
  templateUrl: "./landing-card.component.html",
})
export class LandingCardComponent {}
