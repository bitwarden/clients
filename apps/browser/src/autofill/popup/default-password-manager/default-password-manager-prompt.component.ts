import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { BitwardenLogo } from "@bitwarden/assets/svg";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import {
  BaseCardComponent,
  ButtonModule,
  DialogService,
  SvgModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { IntroCarouselService } from "../../../vault/popup/services/intro-carousel.service";
import { AutofillBrowserSettingsService } from "../../services/autofill-browser-settings.service";

import {
  DefaultPasswordBackgroundDark,
  DefaultPasswordBackgroundLight,
  DefaultPasswordIconDark,
  DefaultPasswordIconLight,
} from "./default-password-manager-illustrations";
import { DefaultPasswordManagerPromptService } from "./default-password-manager-prompt.service";

@Component({
  selector: "autofill-default-password-manager-prompt",
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  templateUrl: "./default-password-manager-prompt.component.html",
  host: {
    class: "tw-block tw-h-full tw-w-full",
  },

  imports: [
    BaseCardComponent,
    ButtonModule,
    I18nPipe,
    PopOutComponent,
    PopupHeaderComponent,
    PopupPageComponent,
    SvgModule,
    TypographyModule,
  ],
})
export class DefaultPasswordManagerPromptComponent implements OnInit {
  private readonly themingService = inject(AbstractThemingService);
  private readonly router = inject(Router);
  private readonly dialogService = inject(DialogService);
  private readonly defaultPasswordManagerPromptService = inject(
    DefaultPasswordManagerPromptService,
  );
  private readonly introCarouselService = inject(IntroCarouselService);
  private readonly autofillBrowserSettingsService = inject(AutofillBrowserSettingsService);

  private readonly isDarkTheme = toSignal(
    this.themingService.theme$.pipe(map((theme) => theme === ThemeTypes.Dark)),
    { initialValue: false },
  );

  protected readonly logo = BitwardenLogo;
  protected readonly backgroundIllustration = computed(() =>
    this.isDarkTheme() ? DefaultPasswordBackgroundDark : DefaultPasswordBackgroundLight,
  );
  protected readonly iconIllustration = computed(() =>
    this.isDarkTheme() ? DefaultPasswordIconDark : DefaultPasswordIconLight,
  );

  async ngOnInit(): Promise<void> {
    if (!(await this.autofillBrowserSettingsService.isDefaultPasswordManagerPromptFlowComplete())) {
      return;
    }

    await this.defaultPasswordManagerPromptService.setPromptDismissed();
    await this.navigateToNextScreen();
  }

  protected async onContinue(): Promise<void> {
    await this.defaultPasswordManagerPromptService.setPromptDismissed();

    const result =
      await this.autofillBrowserSettingsService.disableBrowserAutofillAsDefaultPasswordManager();

    if (result === "denied") {
      await this.dialogService.openSimpleDialog({
        title: { key: "privacyPermissionAdditionNotGrantedTitle" },
        content: { key: "privacyPermissionAdditionNotGrantedDescription" },
        acceptButtonText: { key: "ok" },
        cancelButtonText: null,
        type: "warning",
      });
    }

    await this.navigateToNextScreen();
  }

  protected async onSkip(): Promise<void> {
    await this.defaultPasswordManagerPromptService.setPromptDismissed();
    await this.navigateToNextScreen();
  }

  private async navigateToNextScreen(): Promise<void> {
    const hasIntroCarouselDismissed = await firstValueFrom(
      this.introCarouselService.introCarouselState$,
    );

    await this.router.navigate([hasIntroCarouselDismissed ? "/login" : "/intro-carousel"]);
  }
}
