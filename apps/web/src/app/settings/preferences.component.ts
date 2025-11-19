// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import {
  concatMap,
  filter,
  firstValueFrom,
  map,
  Observable,
  Subject,
  switchMap,
  takeUntil,
  tap,
} from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { getFirstPolicy } from "@bitwarden/common/admin-console/services/policy/default-policy.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DomainSettingsService } from "@bitwarden/common/autofill/services/domain-settings.service";
import {
  VaultTimeout,
  VaultTimeoutAction,
  VaultTimeoutOption,
  VaultTimeoutSettingsService,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Theme, ThemeTypes } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { ThemeStateService } from "@bitwarden/common/platform/theming/theme-state.service";
import { DialogService } from "@bitwarden/components";
import { SessionTimeoutInputComponent } from "@bitwarden/key-management-ui";
import { PermitCipherDetailsPopoverComponent } from "@bitwarden/vault";

import { HeaderModule } from "../layouts/header/header.module";
import { SharedModule } from "../shared";

/**
 * @deprecated Use {@link AppearanceComponent} and {@link SessionTimeoutComponent} instead.
 *
 * TODO Cleanup once feature flag enabled: https://bitwarden.atlassian.net/browse/PM-27297
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-preferences",
  templateUrl: "preferences.component.html",
  imports: [
    SharedModule,
    HeaderModule,
    SessionTimeoutInputComponent,
    PermitCipherDetailsPopoverComponent,
  ],
})
export class PreferencesComponent implements OnInit, OnDestroy {
  // For use in template
  protected readonly VaultTimeoutAction = VaultTimeoutAction;

  protected availableVaultTimeoutActions$: Observable<VaultTimeoutAction[]>;

  vaultTimeoutPolicyCallout: Observable<{
    timeout: { hours: number; minutes: number };
    action: VaultTimeoutAction;
  }>;
  vaultTimeoutOptions: VaultTimeoutOption[];
  localeOptions: any[];
  themeOptions: any[];

  private startingLocale: string;
  private destroy$ = new Subject<void>();

  form = this.formBuilder.group({
    vaultTimeout: [null as VaultTimeout | null],
    vaultTimeoutAction: [VaultTimeoutAction.Lock],
    enableFavicons: true,
    theme: [ThemeTypes.Light as Theme],
    locale: [null as string | null],
  });

  constructor(
    private formBuilder: FormBuilder,
    private policyService: PolicyService,
    private i18nService: I18nService,
    private vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    private platformUtilsService: PlatformUtilsService,
    private themeStateService: ThemeStateService,
    private domainSettingsService: DomainSettingsService,
    private dialogService: DialogService,
    private accountService: AccountService,
  ) {
    this.vaultTimeoutOptions = [
      { name: i18nService.t("oneMinute"), value: 1 },
      { name: i18nService.t("fiveMinutes"), value: 5 },
      { name: i18nService.t("fifteenMinutes"), value: 15 },
      { name: i18nService.t("thirtyMinutes"), value: 30 },
      { name: i18nService.t("oneHour"), value: 60 },
      { name: i18nService.t("fourHours"), value: 240 },
      { name: i18nService.t("onRefresh"), value: VaultTimeoutStringType.OnRestart },
    ];
    if (this.platformUtilsService.isDev()) {
      this.vaultTimeoutOptions.push({
        name: i18nService.t("never"),
        value: VaultTimeoutStringType.Never,
      });
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
      { name: i18nService.t("themeLight"), value: ThemeTypes.Light },
      { name: i18nService.t("themeDark"), value: ThemeTypes.Dark },
      { name: i18nService.t("themeSystem"), value: ThemeTypes.System },
    ];
  }

  async ngOnInit() {
    this.availableVaultTimeoutActions$ =
      this.vaultTimeoutSettingsService.availableVaultTimeoutActions$();

    this.vaultTimeoutPolicyCallout = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) =>
        this.policyService.policiesByType$(PolicyType.MaximumVaultTimeout, userId),
      ),
      getFirstPolicy,
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
      }),
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
        takeUntil(this.destroy$),
      )
      .subscribe();

    const activeAcct = await firstValueFrom(this.accountService.activeAccount$);

    const initialFormValues = {
      vaultTimeout: await firstValueFrom(
        this.vaultTimeoutSettingsService.getVaultTimeoutByUserId$(activeAcct.id),
      ),
      vaultTimeoutAction: await firstValueFrom(
        this.vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$(activeAcct.id),
      ),
      enableFavicons: await firstValueFrom(this.domainSettingsService.showFavicons$),
      theme: await firstValueFrom(this.themeStateService.selectedTheme$),
      locale: (await firstValueFrom(this.i18nService.userSetLocale$)) ?? null,
    };
    this.startingLocale = initialFormValues.locale;
    this.form.setValue(initialFormValues, { emitEvent: false });
  }

  submit = async () => {
    if (!this.form.controls.vaultTimeout.valid) {
      this.platformUtilsService.showToast(
        "error",
        null,
        this.i18nService.t("vaultTimeoutRangeError"),
      );
      return;
    }

    // must get raw value b/c the vault timeout action is disabled when a policy is applied
    // which removes the timeout action property and value from the normal form.value.
    const values = this.form.getRawValue();

    const activeAcct = await firstValueFrom(this.accountService.activeAccount$);

    await this.vaultTimeoutSettingsService.setVaultTimeoutOptions(
      activeAcct.id,
      values.vaultTimeout,
      values.vaultTimeoutAction,
    );

    // Save other preferences (theme, locale, favicons)
    await this.domainSettingsService.setShowFavicons(values.enableFavicons);
    await this.themeStateService.setSelectedTheme(values.theme);
    await this.i18nService.setLocale(values.locale);
    if (values.locale !== this.startingLocale) {
      window.location.reload();
    } else {
      this.platformUtilsService.showToast(
        "success",
        null,
        this.i18nService.t("preferencesUpdated"),
      );
    }
  };

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
