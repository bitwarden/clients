import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { Icon } from "@bitwarden/assets/svg";

import { IconModule } from "../icon";
import { TypographyModule } from "../typography";

@Component({
  selector: "bit-landing-hero",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./landing-hero.component.html",
  imports: [IconModule, TypographyModule],
})
export class LandingHeroComponent {
  readonly icon = input<Icon | null>(null);
  readonly title = input<string | undefined>();
  readonly subtitle = input<string | undefined>();
}
