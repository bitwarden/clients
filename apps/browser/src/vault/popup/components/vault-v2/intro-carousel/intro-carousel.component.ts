import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ItemTypes, LoginCards, NoCredentialsIcon, DevicesIcon } from "@bitwarden/assets/svg";
import { ButtonModule, DialogModule, IconModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultCarouselModule } from "@bitwarden/vault";

import { IntroCarouselService } from "../../../services/intro-carousel.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-intro-carousel",
  templateUrl: "./intro-carousel.component.html",
  imports: [
    VaultCarouselModule,
    ButtonModule,
    IconModule,
    DialogModule,
    TypographyModule,
    JslibModule,
    I18nPipe,
  ],
})
export class IntroCarouselComponent {
  protected itemTypes = ItemTypes;
  protected loginCards = LoginCards;
  protected noCredentials = NoCredentialsIcon;
  protected secureDevices = DevicesIcon;

  constructor(
    private router: Router,
    private introCarouselService: IntroCarouselService,
  ) {}

  protected async navigateToSignup() {
    await this.introCarouselService.setIntroCarouselDismissed();
    await this.router.navigate(["/signup"]);
  }

  protected async navigateToLogin() {
    await this.introCarouselService.setIntroCarouselDismissed();
    await this.router.navigate(["/login"]);
  }
}
