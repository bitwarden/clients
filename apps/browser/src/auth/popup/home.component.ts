import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { Router } from "@angular/router";
import { Subject, firstValueFrom, switchMap, takeUntil } from "rxjs";

import { EnvironmentSelectorComponent } from "@bitwarden/angular/auth/components/environment-selector.component";
import { LoginEmailServiceAbstraction, RegisterRouteService } from "@bitwarden/auth/common";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService, DialogService } from "@bitwarden/components";

import { RegistrationSelfHostedEnvConfigDialogComponent } from "../../../../../libs/auth/src/angular/registration/registration-self-hosted-env-config-dialog/registration-self-hosted-env-config-dialog.component";

import { AccountSwitcherService } from "./account-switching/services/account-switcher.service";

@Component({
  selector: "app-home",
  templateUrl: "home.component.html",
})
export class HomeComponent implements OnInit, OnDestroy {
  @ViewChild(EnvironmentSelectorComponent, { static: true })
  environmentSelector!: EnvironmentSelectorComponent;
  private destroyed$: Subject<void> = new Subject();

  loginInitiated = false;
  formGroup = this.formBuilder.group({
    email: ["", [Validators.required, Validators.email]],
    rememberEmail: [false],
  });

  // TODO: remove when email verification flag is removed
  registerRoute$ = this.registerRouteService.registerRoute$();

  constructor(
    protected platformUtilsService: PlatformUtilsService,
    private formBuilder: FormBuilder,
    private router: Router,
    private i18nService: I18nService,
    private loginEmailService: LoginEmailServiceAbstraction,
    private accountSwitcherService: AccountSwitcherService,
    private registerRouteService: RegisterRouteService,
    private toastService: ToastService,
    private configService: ConfigService,
    private dialogService: DialogService,
  ) {}

  async ngOnInit(): Promise<void> {
    const email = await firstValueFrom(this.loginEmailService.loginEmail$);
    const rememberEmail = this.loginEmailService.getRememberEmail();

    if (email != null) {
      this.formGroup.patchValue({ email, rememberEmail });
    } else {
      const storedEmail = await firstValueFrom(this.loginEmailService.storedEmail$);

      if (storedEmail != null) {
        this.formGroup.patchValue({ email: storedEmail, rememberEmail: true });
      }
    }

    this.environmentSelector.onOpenSelfHostedSettings
      .pipe(
        switchMap(async () => {
          await this.setLoginEmailValues();
          if (
            await this.configService.getFeatureFlag(FeatureFlag.UnauthenticatedExtensionUIRefresh)
          ) {
            await RegistrationSelfHostedEnvConfigDialogComponent.open(this.dialogService);
          } else {
            await this.router.navigate(["environment"]);
          }
        }),
        takeUntil(this.destroyed$),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  get availableAccounts$() {
    return this.accountSwitcherService.availableAccounts$;
  }

  async submit() {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccured"),
        message: this.i18nService.t("invalidEmail"),
      });
      return;
    }

    await this.setLoginEmailValues();
    await this.router.navigate(["login"], { queryParams: { email: this.formGroup.value.email } });
  }

  async setLoginEmailValues() {
    // Note: Browser saves email settings here instead of the login component
    this.loginEmailService.setRememberEmail(this.formGroup.value.rememberEmail);
    await this.loginEmailService.setLoginEmail(this.formGroup.value.email);
    await this.loginEmailService.saveEmailSettings();
  }
}
