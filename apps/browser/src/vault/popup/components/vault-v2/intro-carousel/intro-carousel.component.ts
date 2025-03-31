import { Component, OnInit, signal } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, DialogModule, IconModule, TypographyModule } from "@bitwarden/components";
import { VaultCarouselModule, VaultIcons } from "@bitwarden/vault";

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
  ],
  standalone: true,
})
export class IntroCarouselComponent implements OnInit {
  protected dismissBtnEnabled = signal(false);
  protected securityHandshake = VaultIcons.SecurityHandshake;
  protected loginCards = VaultIcons.LoginCards;
  protected secureUser = VaultIcons.SecureUser;
  protected secureDevices = VaultIcons.SecureDevices;

  constructor(private router: Router) {}

  async ngOnInit() {}

  protected onSlideChange(slideIndex: number) {
    if (slideIndex === 4) {
      this.dismissBtnEnabled.set(true);
    }
  }

  protected async navigateToSignup() {
    await this.router.navigate(["/signup"]);
  }

  protected async navigateToLogin() {
    await this.router.navigate(["/login"]);
  }
}
