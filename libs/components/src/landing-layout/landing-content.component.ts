import { ChangeDetectionStrategy, Component } from "@angular/core";

@Component({
  selector: "bit-landing-content",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./landing-content.component.html",
})
export class LandingContentComponent {}
