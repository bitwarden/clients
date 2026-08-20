import { ChangeDetectionStrategy, Component, DestroyRef, OnInit } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import { filter, firstValueFrom, switchMap } from "rxjs";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import {
  PermitCipherDetailsPopoverComponent,
  VaultCopyButtonsService,
  ShowQuickCopyActionsDetailsPopoverComponent,
} from "@bitwarden/vault";

import { HeaderModule } from "../layouts/header/header.module";
import { SharedModule } from "../shared";

type LocaleOption = {
  name: string;
  value: string | null;
};

type ThemeOption = {
  name: string;
  value: Theme;
};

@Component({
  selector: "app-appearance",
  templateUrl: "appearance.component.html",
  imports: [
    SharedModule,
    HeaderModule,
    PermitCipherDetailsPopoverComponent,
    ShowQuickCopyActionsDetailsPopoverComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppearanceComponent implements OnInit {
  readonly localeOptions: LocaleOption[];
  readonly themeOptions: ThemeOption[];

  /** Controls whether the quick copy actions setting is shown, matching the vault list feature. */
  protected readonly showQuickCopyActionsSetting = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM40435_QuickCopyIconSetting),
    { initialValue: false },
  );

  readonly form = this.formBuilder.group({
    enableFavicons: true,
    theme: [ThemeTypes.Light as Theme],
    locale: [null as string | null],
    showQuickCopyActions: false,
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly i18nService: I18nService,
    private readonly themeStateService: ThemeStateService,
    private readonly domainSettingsService: DomainSettingsService,
    private readonly configService: ConfigService,
    private readonly vaultCopyButtonsService: VaultCopyButtonsService,
    private readonly destroyRef: DestroyRef,
  ) {
    const localeOptions: LocaleOption[] = [];
    i18nService.supportedTranslationLocales.forEach((locale) => {
      let name = locale;
      if (i18nService.localeNames.has(locale)) {
        name += " - " + i18nService.localeNames.get(locale);
      }
      localeOptions.push({ name: name, value: locale });
    });
    localeOptions.sort(Utils.getSortFunction(i18nService, "name"));
    localeOptions.splice(0, 0, { name: i18nService.t("default"), value: null });
    this.localeOptions = localeOptions;
    this.themeOptions = [
      { name: i18nService.t("themeLight"), value: ThemeTypes.Light },
      { name: i18nService.t("themeDark"), value: ThemeTypes.Dark },
      { name: i18nService.t("themeSystem"), value: ThemeTypes.System },
    ];
  }

  async ngOnInit() {
    this.form.setValue(
      {
        enableFavicons: await firstValueFrom(this.domainSettingsService.showFavicons$),
        theme: await firstValueFrom(this.themeStateService.selectedTheme$),
        locale: (await firstValueFrom(this.i18nService.userSetLocale$)) ?? null,
        showQuickCopyActions: await firstValueFrom(
          this.vaultCopyButtonsService.showQuickCopyActions$,
        ),
      },
      { emitEvent: false },
    );

    this.form.controls.enableFavicons.valueChanges
      .pipe(
        filter((enableFavicons) => enableFavicons != null),
        switchMap(async (enableFavicons) => {
          await this.domainSettingsService.setShowFavicons(enableFavicons);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.form.controls.theme.valueChanges
      .pipe(
        filter((theme) => theme != null),
        switchMap(async (theme) => {
          await this.themeStateService.setSelectedTheme(theme);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.form.controls.locale.valueChanges
      .pipe(
        switchMap(async (locale) => {
          await this.i18nService.setLocale(locale);
          window.location.reload();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.form.controls.showQuickCopyActions.valueChanges
      .pipe(
        filter((showQuickCopyActions) => showQuickCopyActions != null),
        switchMap(async (showQuickCopyActions) => {
          await this.vaultCopyButtonsService.setShowQuickCopyActions(showQuickCopyActions);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }
}
