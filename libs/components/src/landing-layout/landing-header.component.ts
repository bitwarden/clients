import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { RouterModule } from "@angular/router";

import { BitwardenLogo } from "@bitwarden/assets/svg";

import { IconModule } from "../icon";
import { SharedModule } from "../shared";

@Component({
  selector: "bit-landing-header",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./landing-header.component.html",
  imports: [RouterModule, IconModule, SharedModule],
})
export class LandingHeaderComponent {
  readonly hideLogo = input<boolean>(false);
  protected readonly logo = BitwardenLogo;
}
