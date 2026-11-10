import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { map } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { BitwardenLogo } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import {
  ButtonModule,
  IconTileComponent,
  SvgModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { consumeDefaultPasswordManagerSuccessToast } from "../../../../../autofill/default-password-manager-session.util";
import { PopOutComponent } from "../../../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../../../platform/popup/layout/popup-page.component";
import { IntroCarouselService } from "../../../services/intro-carousel.service";

import { WelcomeBackgroundDark, WelcomeBackgroundLight } from "./welcome-page-illustrations";

/** Single-page replacement for the intro carousel, gated by `PM45335_ExtensionWelcomePage`. */
@Component({
  selector: "app-welcome-page",
  templateUrl: "./welcome-page.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "tw-block tw-h-full tw-w-full",
  },
  imports: [
    ButtonModule,
    I18nPipe,
    IconTileComponent,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    SvgModule,
    TypographyModule,
  ],
})
export class WelcomePageComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly introCarouselService = inject(IntroCarouselService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly themingService = inject(AbstractThemingService);

  private readonly isDarkTheme = toSignal(
    this.themingService.theme$.pipe(map((theme) => theme === ThemeTypes.Dark)),
    { initialValue: false },
  );

  protected readonly logo = BitwardenLogo;
  protected readonly backgroundIllustration = computed(() =>
    this.isDarkTheme() ? WelcomeBackgroundDark : WelcomeBackgroundLight,
  );

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
