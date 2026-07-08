import { ChangeDetectionStrategy, Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ItemTypes, LoginCards, NoCredentialsIcon, DevicesIcon } from "@bitwarden/assets/svg";
import { consumeDefaultPasswordManagerSuccessToast } from "@bitwarden/browser/autofill/default-password-manager-session.util";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonModule,
  DialogModule,
  SvgModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { VaultCarouselModule } from "@bitwarden/vault";

import { IntroCarouselService } from "../../../services/intro-carousel.service";

@Component({
  selector: "app-intro-carousel",
  templateUrl: "./intro-carousel.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    VaultCarouselModule,
    ButtonModule,
    SvgModule,
    DialogModule,
    TypographyModule,
    JslibModule,
    I18nPipe,
  ],
})
export class IntroCarouselComponent implements OnInit {
  protected readonly itemTypes = ItemTypes;
  protected readonly loginCards = LoginCards;
  protected readonly noCredentials = NoCredentialsIcon;
  protected readonly secureDevices = DevicesIcon;

  constructor(
    private readonly router: Router,
    private readonly introCarouselService: IntroCarouselService,
    private readonly toastService: ToastService,
    private readonly i18nService: I18nService,
  ) {}

  async ngOnInit() {
    if (!(await consumeDefaultPasswordManagerSuccessToast())) {
      return;
    }

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("defaultPasswordManagerSuccessToast"),
    });
  }

  protected async navigateToSignup() {
    await this.introCarouselService.setIntroCarouselDismissed();
    await this.router.navigate(["/signup"]);
  }

  protected async navigateToLogin() {
    await this.introCarouselService.setIntroCarouselDismissed();
    await this.router.navigate(["/login"]);
  }
}
