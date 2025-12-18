import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "bit-landing-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./landing-header.component.html",
})
export class LandingHeaderComponent {
  readonly hideLogo = input<boolean>(false);
}
