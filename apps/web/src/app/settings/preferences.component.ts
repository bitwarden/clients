import { Component, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { concatMap, filter, firstValueFrom, map, Observable, Subject, takeUntil, tap } from "rxjs";

import { AbstractThemingService } from "@bitwarden/angular/services/theming/theming.service.abstraction";
import { SettingsService } from "@bitwarden/common/abstractions/settings.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/abstractions/vault-timeout/vault-timeout-settings.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { ThemeType } from "@bitwarden/common/enums";
import { VaultTimeoutAction } from "@bitwarden/common/enums/vault-timeout-action.enum";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { DialogService } from "@bitwarden/components";

@Component({
  selector: "app-preferences",
  templateUrl: "preferences.component.html",
})
export class PreferencesComponent implements OnInit {
  // For use in template
  protected readonly VaultTimeoutAction = VaultTimeoutAction;

  protected availableVaultTimeoutActions$: Observable<VaultTimeoutAction[]>;

  vaultTimeoutPolicyCallout: Observable<{
    timeout: { hours: number; minutes: number };
    action: VaultTimeoutAction;
  }>;
  vaultTimeoutOptions: { name: string; value: number }[];
  localeOptions: any[];
  themeOptions: any[];

  private startingLocale: string;
  private startingTheme: ThemeType;
  private destroy$ = new Subject<void>();

  form = this.formBuilder.group({
    vaultTimeout: [null as number | null],
    vaultTimeoutAction: [VaultTimeoutAction.Lock],
    enableFavicons: true,
    enableFullWidth: false,
    theme: [ThemeType.Light],
    locale: [null as string | null],
  });

  constructor(
    private formBuilder: FormBuilder,
    private policyService: PolicyService,
    private stateService: StateService,
    private i18nService: I18nService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private platformUtilsService: PlatformUtilsService,
    private messagingService: MessagingService,
    private themingService: AbstractThemingService,
    private settingsService: SettingsService,
    private dialogService: DialogService
  ) {
    this.vaultTimeoutOptions = [
      { name: i18nService.t("oneMinute"), value: 1 },
      { name: i18nService.t("fiveMinutes"), value: 5 },
      { name: i18nService.t("fifteenMinutes"), value: 15 },
      { name: i18nService.t("thirtyMinutes"), value: 30 },
      { name: i18nService.t("oneHour"), value: 60 },
      { name: i18nService.t("fourHours"), value: 240 },
      { name: i18nService.t("onRefresh"), value: -1 },
    ];
    if (this.platformUtilsService.isDev()) {
      this.vaultTimeoutOptions.push({ name: i18nService.t("never"), value: null });
    }

    const localeOptions: any[] = [];
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
      { name: i18nService.t("themeLight"), value: ThemeType.Light },
      { name: i18nService.t("themeDark"), value: ThemeType.Dark },
      { name: i18nService.t("themeSystem"), value: ThemeType.System },
    ];
  }

  async ngOnInit() {
    this.availableVaultTimeoutActions$ =
      this.vaultTimeoutSettingsService.availableVaultTimeoutActions$();

    this.vaultTimeoutPolicyCallout = this.policyService.get$(PolicyType.MaximumVaultTimeout).pipe(
      filter((policy) => policy != null),
      map((policy) => {
        let timeout;
        if (policy.data?.minutes) {
          timeout = {
            hours: Math.floor(policy.data?.minutes / 60),
            minutes: policy.data?.minutes % 60,
          };
        }
        return { timeout: timeout, action: policy.data?.action };
      }),
      tap((policy) => {
        if (policy.action) {
          this.form.controls.vaultTimeoutAction.disable({ emitEvent: false });
        } else {
          this.form.controls.vaultTimeoutAction.enable({ emitEvent: false });
        }
      })
    );

    this.form.controls.vaultTimeoutAction.valueChanges
      .pipe(
        concatMap(async (action) => {
          if (action === VaultTimeoutAction.LogOut) {
            const confirmed = await this.dialogService.openSimpleDialog({
              title: { key: "vaultTimeoutLogOutConfirmationTitle" },
              content: { key: "vaultTimeoutLogOutConfirmation" },
              type: "warning",
            });

            if (!confirmed) {
              this.form.controls.vaultTimeoutAction.patchValue(VaultTimeoutAction.Lock, {
                emitEvent: false,
              });
              return;
            }
          }
        }),
        takeUntil(this.destroy$)
      )
      .subscribe();
    const initialFormValues = {
      vaultTimeout: await this.vaultTimeoutSettingsService.getVaultTimeout(),
      vaultTimeoutAction: await firstValueFrom(
        this.vaultTimeoutSettingsService.vaultTimeoutAction$()
      ),
      enableFavicons: !(await this.settingsService.getDisableFavicon()),
      enableFullWidth: await this.stateService.getEnableFullWidth(),
      theme: await this.stateService.getTheme(),
      locale: (await this.stateService.getLocale()) ?? null,
    };
    this.startingLocale = initialFormValues.locale;
    this.startingTheme = initialFormValues.theme;
    this.form.setValue(initialFormValues, { emitEvent: false });
  }

  async submit() {
    if (!this.form.controls.vaultTimeout.valid) {
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("vaultTimeoutRangeError")
      );
      return;
    }
    const values = this.form.value;

    await this.vaultTimeoutSettingsService.setVaultTimeoutOptions(
      values.vaultTimeout,
      values.vaultTimeoutAction
    );
    await this.settingsService.setDisableFavicon(!values.enableFavicons);
    await this.stateService.setEnableFullWidth(values.enableFullWidth);
    this.messagingService.send("setFullWidth");
    if (values.theme !== this.startingTheme) {
      await this.themingService.updateConfiguredTheme(values.theme);
      this.startingTheme = values.theme;
    }
    await this.stateService.setLocale(values.locale);
    if (values.locale !== this.startingLocale) {
      window.location.reload();
    } else {
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("preferencesUpdated")
      );
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
