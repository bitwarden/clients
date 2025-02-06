// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject, OnDestroy, OnInit, ViewChild, ViewContainerRef } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, takeUntil, lastValueFrom } from "rxjs";

import { TwoFactorComponentV1 as BaseTwoFactorComponent } from "@bitwarden/angular/auth/components/two-factor-v1.component";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  TwoFactorOptionsDialogResult,
  TwoFactorOptionsComponentV1,
  TwoFactorOptionsDialogResultType,
} from "./two-factor-options-v1.component";

@Component({
  selector: "app-two-factor",
  templateUrl: "two-factor-v1.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class TwoFactorComponentV1 extends BaseTwoFactorComponent implements OnInit, OnDestroy {
  @ViewChild("twoFactorOptions", { read: ViewContainerRef, static: true })
  twoFactorOptionsModal: ViewContainerRef;
  formGroup = this.formBuilder.group({
    token: [
      "",
      {
        validators: [Validators.required],
        updateOn: "submit",
      },
    ],
    remember: [false],
  });
  private destroy$ = new Subject<void>();
  constructor(
    loginStrategyService: LoginStrategyServiceAbstraction,
    router: Router,
    i18nService: I18nService,
    apiService: ApiService,
    platformUtilsService: PlatformUtilsService,
    stateService: StateService,
    environmentService: EnvironmentService,
    private dialogService: DialogService,
    route: ActivatedRoute,
    logService: LogService,
    twoFactorService: TwoFactorService,
    appIdService: AppIdService,
    loginEmailService: LoginEmailServiceAbstraction,
    userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    ssoLoginService: SsoLoginServiceAbstraction,
    configService: ConfigService,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    accountService: AccountService,
    toastService: ToastService,
    private formBuilder: FormBuilder,
    @Inject(WINDOW) protected win: Window,
  ) {
    super(
      loginStrategyService,
      router,
      i18nService,
      apiService,
      platformUtilsService,
      win,
      environmentService,
      stateService,
      route,
      logService,
      twoFactorService,
      appIdService,
      loginEmailService,
      userDecryptionOptionsService,
      ssoLoginService,
      configService,
      masterPasswordService,
      accountService,
      toastService,
    );
    this.onSuccessfulLoginNavigate = this.goAfterLogIn;
  }
  async ngOnInit() {
    await super.ngOnInit();
    this.formGroup.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((value) => {
      this.token = value.token;
      this.remember = value.remember;
    });
  }
  submitForm = async () => {
    await this.submit();
  };

  async anotherMethod() {
    const dialogRef = TwoFactorOptionsComponentV1.open(this.dialogService);
    const response: TwoFactorOptionsDialogResultType = await lastValueFrom(dialogRef.closed);
    if (response.result === TwoFactorOptionsDialogResult.Provider) {
      this.selectedProviderType = response.type;
      await this.init();
    }
  }

  protected override handleMigrateEncryptionKey(result: AuthResult): boolean {
    if (!result.requiresEncryptionKeyMigration) {
      return false;
    }
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["migrate-legacy-encryption"]);
    return true;
  }

  goAfterLogIn = async () => {
    this.loginEmailService.clearValues();
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate([this.successRoute], {
      queryParams: {
        identifier: this.orgIdentifier,
      },
    });
  };

  private duoResultChannel: BroadcastChannel;

  protected override setupDuoResultListener() {
    if (!this.duoResultChannel) {
      this.duoResultChannel = new BroadcastChannel("duoResult");
      this.duoResultChannel.addEventListener("message", this.handleDuoResultMessage);
    }
  }

  private handleDuoResultMessage = async (msg: { data: { code: string; state: string } }) => {
    this.token = msg.data.code + "|" + msg.data.state;
    await this.submit();
  };

  async ngOnDestroy() {
    super.ngOnDestroy();

    if (this.duoResultChannel) {
      // clean up duo listener if it was initialized.
      this.duoResultChannel.removeEventListener("message", this.handleDuoResultMessage);
      this.duoResultChannel.close();
    }
  }
}
