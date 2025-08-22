import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { SecurityHandshake, LoginCards, SecureUser, SecureDevices } from "@bitwarden/assets/svg";
import { ButtonModule, DialogModule, IconModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultCarouselModule } from "@bitwarden/vault";

import { IntroCarouselService } from "../../../services/intro-carousel.service";

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
  protected securityHandshake = SecurityHandshake;
  protected loginCards = LoginCards;
  protected secureUser = SecureUser;
  protected secureDevices = SecureDevices;

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
