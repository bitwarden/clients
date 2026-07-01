import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/platform/services/theming/theming.service.abstraction";
import { BitwardenLogo } from "@bitwarden/assets/svg";
import { BrowserClientVendors } from "@bitwarden/common/autofill/constants";
import { ThemeTypes } from "@bitwarden/common/platform/enums";
import {
  BaseCardComponent,
  ButtonModule,
  DialogService,
  SvgModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { BrowserApi } from "../../../platform/browser/browser-api";
import BrowserPopupUtils from "../../../platform/browser/browser-popup-utils";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import { IntroCarouselService } from "../../../vault/popup/services/intro-carousel.service";
import { applyDefaultPasswordManagerOverride } from "../../default-password-manager-session.util";
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

  private readonly privacyPermissionIsGranted = signal(false);

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
    if (BrowserApi.getBrowserClientVendor(window) !== BrowserClientVendors.Unknown) {
      this.privacyPermissionIsGranted.set(await BrowserApi.permissionsGranted(["privacy"]));
    }

    if (!(await this.autofillBrowserSettingsService.isDefaultPasswordManagerPromptFlowComplete())) {
      return;
    }

    await this.defaultPasswordManagerPromptService.setPromptDismissed();
    await this.navigateToNextScreen();
  }

  protected onContinueClick(): void {
    if (BrowserApi.isFirefox && !this.privacyPermissionIsGranted()) {
      if (BrowserPopupUtils.inPopout(window)) {
        void this.continueFirefoxPopout();
      } else {
        this.autofillBrowserSettingsService.requestPrivacyPermissionFromUserGesture();
        void this.continueFirefoxPopup();
      }
      return;
    }

    void this.continueWithDefaultPasswordManagerApply();
  }

  private async continueFirefoxPopout(): Promise<void> {
    const permissionGranted = BrowserApi.requestPermission({ permissions: ["privacy"] });
    await this.defaultPasswordManagerPromptService.setPromptDismissed();

    if (await permissionGranted) {
      await applyDefaultPasswordManagerOverride();
    } else {
      await this.showPrivacyPermissionDeniedDialog();
    }

    await this.navigateToNextScreen();
  }

  private async continueFirefoxPopup(): Promise<void> {
    await this.defaultPasswordManagerPromptService.setPromptDismissed();
    await this.autofillBrowserSettingsService.completeFirefoxPopupPermissionFlow(window);
  }

  private async continueWithDefaultPasswordManagerApply(): Promise<void> {
    await this.defaultPasswordManagerPromptService.setPromptDismissed();

    if (
      (await this.autofillBrowserSettingsService.disableBrowserAutofillAsDefaultPasswordManager()) ===
      "denied"
    ) {
      await this.showPrivacyPermissionDeniedDialog();
    }

    await this.navigateToNextScreen();
  }

  protected async onSkip(): Promise<void> {
    await this.defaultPasswordManagerPromptService.setPromptDismissed();
    await this.navigateToNextScreen();
  }

  private async showPrivacyPermissionDeniedDialog(): Promise<void> {
    await this.dialogService.openSimpleDialog({
      title: { key: "privacyPermissionAdditionNotGrantedTitle" },
      content: { key: "privacyPermissionAdditionNotGrantedDescription" },
      acceptButtonText: { key: "ok" },
      cancelButtonText: null,
      type: "warning",
    });
  }

  private async navigateToNextScreen(): Promise<void> {
    const introCarouselDismissed = await firstValueFrom(
      this.introCarouselService.introCarouselState$,
    );

    await this.router.navigate([introCarouselDismissed ? "/login" : "/intro-carousel"]);
  }
}
