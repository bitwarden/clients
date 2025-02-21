// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, NgZone, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { takeUntil } from "rxjs";
import { first } from "rxjs/operators";

import { LoginComponentV1 as BaseLoginComponent } from "@bitwarden/angular/auth/components/login-v1.component";
import { FormValidationErrorsService } from "@bitwarden/angular/platform/abstractions/form-validation-errors.service";
import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
} from "@bitwarden/auth/common";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyData } from "@bitwarden/common/admin-console/models/data/policy.data";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { DevicesApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices-api.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { RouterService } from "../../core";
import { AcceptOrganizationInviteService } from "../organization-invite/accept-organization.service";
import { OrganizationInvite } from "../organization-invite/organization-invite";

@Component({
  selector: "app-login",
  templateUrl: "login-v1.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class LoginComponentV1 extends BaseLoginComponent implements OnInit {
  showResetPasswordAutoEnrollWarning = false;
  enforcedPasswordPolicyOptions: MasterPasswordPolicyOptions;
  policies: Policy[];

  constructor(
    private acceptOrganizationInviteService: AcceptOrganizationInviteService,
    devicesApiService: DevicesApiServiceAbstraction,
    appIdService: AppIdService,
    loginStrategyService: LoginStrategyServiceAbstraction,
    router: Router,
    i18nService: I18nService,
    route: ActivatedRoute,
    platformUtilsService: PlatformUtilsService,
    environmentService: EnvironmentService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    private passwordStrengthService: PasswordStrengthServiceAbstraction,
    cryptoFunctionService: CryptoFunctionService,
    private policyApiService: PolicyApiServiceAbstraction,
    private policyService: InternalPolicyService,
    logService: LogService,
    ngZone: NgZone,
    protected stateService: StateService,
    private routerService: RouterService,
    formBuilder: FormBuilder,
    formValidationErrorService: FormValidationErrorsService,
    loginEmailService: LoginEmailServiceAbstraction,
    ssoLoginService: SsoLoginServiceAbstraction,
    toastService: ToastService,
  ) {
    super(
      devicesApiService,
      appIdService,
      loginStrategyService,
      router,
      platformUtilsService,
      i18nService,
      stateService,
      environmentService,
      passwordGenerationService,
      cryptoFunctionService,
      logService,
      ngZone,
      formBuilder,
      formValidationErrorService,
      route,
      loginEmailService,
      ssoLoginService,
      toastService,
    );
    this.onSuccessfulLoginNavigate = this.goAfterLogIn;
  }

  submitForm = async (showToast = true) => {
    return await this.submitFormHelper(showToast);
  };

  private async submitFormHelper(showToast: boolean) {
    await super.submit(showToast);
  }

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      // If there is a query parameter called 'org', set previousUrl to `/create-organization?org=paramValue`
      if (qParams.org != null) {
        const route = this.router.createUrlTree(["create-organization"], {
          queryParams: { plan: qParams.org },
        });
        this.routerService.setPreviousUrl(route.toString());
      }

      /**
       * If there is a query parameter called 'sponsorshipToken', that means they are coming
       * from an email for sponsoring a families organization. If so, then set the prevousUrl
       * to `/setup/families-for-enterprise?token=paramValue`
       */
      if (qParams.sponsorshipToken != null) {
        const route = this.router.createUrlTree(["setup/families-for-enterprise"], {
          queryParams: { token: qParams.sponsorshipToken },
        });
        this.routerService.setPreviousUrl(route.toString());
      }

      await super.ngOnInit();
    });

    // If there's an existing org invite, use it to get the password policies
    const orgInvite = await this.acceptOrganizationInviteService.getOrganizationInvite();
    if (orgInvite != null) {
      await this.initPasswordPolicies(orgInvite);
    }
  }

  async goAfterLogIn(userId: UserId) {
    const masterPassword = this.formGroup.value.masterPassword;

    // Check master password against policy
    if (this.enforcedPasswordPolicyOptions != null) {
      const strengthResult = this.passwordStrengthService.getPasswordStrength(
        masterPassword,
        this.formGroup.value.email,
      );
      const masterPasswordScore = strengthResult == null ? null : strengthResult.score;

      // If invalid, save policies and require update
      if (
        !this.policyService.evaluateMasterPassword(
          masterPasswordScore,
          masterPassword,
          this.enforcedPasswordPolicyOptions,
        )
      ) {
        const policiesData: { [id: string]: PolicyData } = {};
        this.policies.map((p) => (policiesData[p.id] = PolicyData.fromPolicy(p)));
        await this.policyService.replace(policiesData, userId);
        await this.router.navigate(["update-password"]);
        return;
      }
    }

    this.loginEmailService.clearValues();
    await this.router.navigate([this.successRoute]);
  }

  async goToHint() {
    await this.saveEmailSettings();
    await this.router.navigateByUrl("/hint");
  }

  async goToRegister() {
    if (this.emailFormControl.valid) {
      await this.router.navigate(["/signup"], {
        queryParams: { email: this.emailFormControl.value },
      });
      return;
    }

    await this.router.navigate(["/signup"]);
  }

  protected override async handleMigrateEncryptionKey(result: AuthResult): Promise<boolean> {
    if (!result.requiresEncryptionKeyMigration) {
      return false;
    }
    await this.router.navigate(["migrate-legacy-encryption"]);
    return true;
  }

  private async initPasswordPolicies(invite: OrganizationInvite): Promise<void> {
    try {
      this.policies = await this.policyApiService.getPoliciesByToken(
        invite.organizationId,
        invite.token,
        invite.email,
        invite.organizationUserId,
      );
    } catch (e) {
      this.logService.error(e);
    }

    if (this.policies == null) {
      return;
    }

    const resetPasswordPolicy = this.policyService.getResetPasswordPolicyOptions(
      this.policies,
      invite.organizationId,
    );

    // Set to true if policy enabled and auto-enroll enabled
    this.showResetPasswordAutoEnrollWarning =
      resetPasswordPolicy[1] && resetPasswordPolicy[0].autoEnrollEnabled;

    this.policyService
      .masterPasswordPolicyOptions$(this.policies)
      .pipe(takeUntil(this.destroy$))
      .subscribe((enforcedPasswordPolicyOptions) => {
        this.enforcedPasswordPolicyOptions = enforcedPasswordPolicyOptions;
      });
  }
}
