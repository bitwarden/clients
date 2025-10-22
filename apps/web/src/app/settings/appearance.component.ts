import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { filter, firstValueFrom, Subject, switchMap, takeUntil } from "rxjs";

import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { ToastService } from "@bitwarden/components";
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
export class AppearanceComponent implements OnInit, OnDestroy {
  localeOptions: LocaleOption[];
  themeOptions: ThemeOption[];

  private destroy$ = new Subject<void>();

  form = this.formBuilder.group({
    enableFavicons: true,
    theme: [ThemeTypes.Light as Theme],
    locale: [null as string | null],
  });

  constructor(
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private toastService: ToastService,
    private themeStateService: ThemeStateService,
    private domainSettingsService: DomainSettingsService,
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
      },
      { emitEvent: false },
    );

    this.form.controls.enableFavicons.valueChanges
      .pipe(
        filter((enableFavicons) => enableFavicons != null),
        switchMap(async (enableFavicons) => {
          await this.domainSettingsService.setShowFavicons(enableFavicons);
          this.showSuccessToast();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.theme.valueChanges
      .pipe(
        filter((theme) => theme != null),
        switchMap(async (theme) => {
          await this.themeStateService.setSelectedTheme(theme);
          this.showSuccessToast();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.form.controls.locale.valueChanges
      .pipe(
        filter((locale) => locale != null),
        switchMap(async (locale) => {
          await this.i18nService.setLocale(locale);
          window.location.reload();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  private showSuccessToast() {
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("appearanceUpdated"),
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
