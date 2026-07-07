import { ChangeDetectionStrategy, Component, DestroyRef, OnInit } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import { concatMap, filter, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EarlyAccessService } from "@bitwarden/common/platform/services/early-access/early-access.service";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { DialogService, SwitchComponent } from "@bitwarden/components";
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
  imports: [SharedModule, HeaderModule, PermitCipherDetailsPopoverComponent, SwitchComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppearanceComponent implements OnInit {
  readonly localeOptions: LocaleOption[];
  readonly themeOptions: ThemeOption[];

  readonly form = this.formBuilder.group({
    enableFavicons: true,
    theme: [ThemeTypes.Light as Theme],
    locale: [null as string | null],
    earlyAccess: false,
  });

  protected readonly showEarlyAccessToggle = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.EarlyAccess),
    { initialValue: false },
  );

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly i18nService: I18nService,
    private readonly themeStateService: ThemeStateService,
    private readonly domainSettingsService: DomainSettingsService,
    private readonly accountService: AccountService,
    private readonly configService: ConfigService,
    private readonly earlyAccessService: EarlyAccessService,
    private readonly dialogService: DialogService,
    private readonly logService: LogService,
    private readonly validationService: ValidationService,
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
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.form.setValue(
      {
        enableFavicons: await firstValueFrom(this.domainSettingsService.showFavicons$),
        theme: await firstValueFrom(this.themeStateService.selectedTheme$),
        locale: (await firstValueFrom(this.i18nService.userSetLocale$)) ?? null,
        earlyAccess: await firstValueFrom(this.earlyAccessService.earlyAccess$(userId)),
      },
      { emitEvent: false },
    );

    this.form.controls.earlyAccess.valueChanges
      .pipe(
        concatMap(async (enabled) => this.onEarlyAccessChange(enabled ?? false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

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
  }

  private async onEarlyAccessChange(enabled: boolean): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    try {
      if (!enabled) {
        await this.earlyAccessService.setEarlyAccess(userId, false);
        return;
      }

      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "enableEarlyAccessConfirmTitle" },
        content: { key: "enableEarlyAccessConfirmContent" },
        type: "warning",
      });
      if (!confirmed) {
        this.form.controls.earlyAccess.setValue(false, { emitEvent: false });
        return;
      }

      await this.earlyAccessService.setEarlyAccess(userId, true);
    } catch (error) {
      this.logService.error("Error updating Early Access preference: ", error);
      this.form.controls.earlyAccess.setValue(!enabled, { emitEvent: false });
      this.validationService.showError(error);
    }
  }
}
