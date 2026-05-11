import { ChangeDetectionStrategy, Component, DestroyRef, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import { filter, firstValueFrom, skip, switchMap } from "rxjs";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { AccentColorStateService } from "@bitwarden/common/platform/theming/accent-color-state.service";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { PermitCipherDetailsPopoverComponent } from "@bitwarden/vault";

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
  imports: [SharedModule, HeaderModule, PermitCipherDetailsPopoverComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppearanceComponent implements OnInit {
  readonly localeOptions: LocaleOption[];
  readonly themeOptions: ThemeOption[];

  private readonly accentBrandDefault = "#175ddc";

  readonly form = this.formBuilder.group({
    enableFavicons: true,
    theme: [ThemeTypes.Light as Theme],
    locale: [null as string | null],
    accentColorHexUi: [this.accentBrandDefault],
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly i18nService: I18nService,
    private readonly themeStateService: ThemeStateService,
    private readonly accentColorStateService: AccentColorStateService,
    private readonly domainSettingsService: DomainSettingsService,
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
      { name: i18nService.t("themeOled"), value: ThemeTypes.Oled },
      { name: i18nService.t("themeSystem"), value: ThemeTypes.System },
    ];
  }

  async ngOnInit() {
    const accentPersisted = await firstValueFrom(this.accentColorStateService.accentColorHex$);

    this.form.setValue(
      {
        enableFavicons: await firstValueFrom(this.domainSettingsService.showFavicons$),
        theme: await firstValueFrom(this.themeStateService.selectedTheme$),
        locale: (await firstValueFrom(this.i18nService.userSetLocale$)) ?? null,
        accentColorHexUi: accentPersisted ?? this.accentBrandDefault,
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

    this.form.controls.accentColorHexUi.valueChanges
      .pipe(
        skip(1),
        filter((hex): hex is string => typeof hex === "string" && /^#[0-9A-Fa-f]{6}$/.test(hex)),
        switchMap(async (hex) => {
          const normalized = hex.toLowerCase();
          if (normalized === this.accentBrandDefault.toLowerCase()) {
            await this.accentColorStateService.setAccentColor(null);
          } else {
            await this.accentColorStateService.setAccentColor(normalized);
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    this.form.controls.locale.valueChanges
      .pipe(
        switchMap(async (locale) => {
          await this.i18nService.setLocale(locale);
          this.reloadBrowserWindow();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  protected reloadBrowserWindow(): void {
    window.location.reload();
  }
}
