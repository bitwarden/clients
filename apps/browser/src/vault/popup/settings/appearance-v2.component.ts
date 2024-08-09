import { CommonModule } from "@angular/common";
import { Component, DestroyRef, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { BadgeSettingsServiceAbstraction } from "@bitwarden/common/autofill/services/badge-settings.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { ThemeType } from "@bitwarden/common/platform/enums";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { CheckboxModule } from "@bitwarden/components";

import { CardComponent } from "../../../../../../libs/components/src/card/card.component";
import { FormFieldModule } from "../../../../../../libs/components/src/form-field/form-field.module";
import { SelectModule } from "../../../../../../libs/components/src/select/select.module";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  standalone: true,
  templateUrl: "./appearance-v2.component.html",
  imports: [
    CommonModule,
    JslibModule,
    PopupPageComponent,
    PopupHeaderComponent,
    PopOutComponent,
    CardComponent,
    FormFieldModule,
    SelectModule,
    ReactiveFormsModule,
    CheckboxModule,
  ],
})
export class AppearanceV2Component implements OnInit {
  appearanceForm = this.formBuilder.group({
    enableFavicon: false,
    enableBadgeCounter: true,
    theme: ThemeType.System,
  });

  /** Available theme options */
  themeOptions: { name: string; value: ThemeType }[];

  constructor(
    private messagingService: MessagingService,
    private domainSettingsService: DomainSettingsService,
    private badgeSettingsService: BadgeSettingsServiceAbstraction,
    private themeStateService: ThemeStateService,
    private formBuilder: FormBuilder,
    private destroyRef: DestroyRef,
    i18nService: I18nService,
  ) {
    this.themeOptions = [
      { name: i18nService.t("systemDefault"), value: ThemeType.System },
      { name: i18nService.t("light"), value: ThemeType.Light },
      { name: i18nService.t("dark"), value: ThemeType.Dark },
      { name: "Nord", value: ThemeType.Nord },
      { name: i18nService.t("solarizedDark"), value: ThemeType.SolarizedDark },
    ];
  }

  async ngOnInit() {
    const enableFavicon = await firstValueFrom(this.domainSettingsService.showFavicons$);
    const enableBadgeCounter = await firstValueFrom(this.badgeSettingsService.enableBadgeCounter$);
    const theme = await firstValueFrom(this.themeStateService.selectedTheme$);

    // Set initial values for the form
    this.appearanceForm.setValue({
      enableFavicon,
      enableBadgeCounter,
      theme,
    });

    this.appearanceForm.controls.theme.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((newTheme) => {
        void this.saveTheme(newTheme);
      });

    this.appearanceForm.controls.enableFavicon.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enableFavicon) => {
        void this.updateFavicon(enableFavicon);
      });

    this.appearanceForm.controls.enableBadgeCounter.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enableBadgeCounter) => {
        void this.updateBadgeCounter(enableBadgeCounter);
      });
  }

  async updateFavicon(enableFavicon: boolean) {
    await this.domainSettingsService.setShowFavicons(enableFavicon);
  }

  async updateBadgeCounter(enableBadgeCounter: boolean) {
    await this.badgeSettingsService.setEnableBadgeCounter(enableBadgeCounter);
    this.messagingService.send("bgUpdateContextMenu");
  }

  async saveTheme(newTheme: ThemeType) {
    await this.themeStateService.setSelectedTheme(newTheme);
  }
}
