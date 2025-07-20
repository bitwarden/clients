import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, DialogModule, IconModule, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultCarouselModule, VaultIcons } from "@bitwarden/vault";

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
  protected securityHandshake = VaultIcons.SecurityHandshake;
  protected loginCards = VaultIcons.LoginCards;
  protected secureUser = VaultIcons.SecureUser;
  protected secureDevices = VaultIcons.SecureDevices;

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
