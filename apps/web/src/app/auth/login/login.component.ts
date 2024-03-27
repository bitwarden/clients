import { Component, NgZone, OnInit } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { takeUntil } from "rxjs";
import { first } from "rxjs/operators";

import { LoginComponent as BaseLoginComponent } from "@bitwarden/angular/auth/components/login.component";
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
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { DevicesApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices-api.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { WebAuthnLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login.service.abstraction";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";

import { flagEnabled } from "../../../utils/flags";
import { RouterService, StateService } from "../../core";

@Component({
  selector: "app-login",
  templateUrl: "login.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class LoginComponent extends BaseLoginComponent implements OnInit {
  showResetPasswordAutoEnrollWarning = false;
  enforcedPasswordPolicyOptions: MasterPasswordPolicyOptions;
  policies: ListResponse<PolicyResponse>;
  showPasswordless = false;

  constructor(
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
    webAuthnLoginService: WebAuthnLoginServiceAbstraction,
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
      webAuthnLoginService,
    );
    this.onSuccessfulLoginNavigate = this.goAfterLogIn;
    this.showPasswordless = flagEnabled("showPasswordless");
  }

  async ngOnInit() {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      if (qParams.org != null) {
        const route = this.router.createUrlTree(["create-organization"], {
          queryParams: { plan: qParams.org },
        });
        this.routerService.setPreviousUrl(route.toString());
      }

      // Are they coming from an email for sponsoring a families organization
      if (qParams.sponsorshipToken != null) {
        const route = this.router.createUrlTree(["setup/families-for-enterprise"], {
          queryParams: { token: qParams.sponsorshipToken },
        });
        this.routerService.setPreviousUrl(route.toString());
      }
      await super.ngOnInit();
    });

    const invite = await this.stateService.getOrganizationInvitation();
    if (invite != null) {
      let policyList: Policy[] = null;
      try {
        this.policies = await this.policyApiService.getPoliciesByToken(
          invite.organizationId,
          invite.token,
          invite.email,
          invite.organizationUserId,
        );
        policyList = Policy.fromListResponse(this.policies);
      } catch (e) {
        this.logService.error(e);
      }

      if (policyList != null) {
        const resetPasswordPolicy = this.policyService.getResetPasswordPolicyOptions(
          policyList,
          invite.organizationId,
        );
        // Set to true if policy enabled and auto-enroll enabled
        this.showResetPasswordAutoEnrollWarning =
          resetPasswordPolicy[1] && resetPasswordPolicy[0].autoEnrollEnabled;

        this.policyService
          .masterPasswordPolicyOptions$(policyList)
          .pipe(takeUntil(this.destroy$))
          .subscribe((enforcedPasswordPolicyOptions) => {
            this.enforcedPasswordPolicyOptions = enforcedPasswordPolicyOptions;
          });
      }
    }
  }

  async goAfterLogIn() {
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
        this.policies.data.map((p) => (policiesData[p.id] = new PolicyData(p)));
        await this.policyService.replace(policiesData);
        // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.router.navigate(["update-password"]);
        return;
      }
    }

    this.loginEmailService.clearValues();
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate([this.successRoute]);
  }

  goToHint() {
    this.setLoginEmailValues();
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigateByUrl("/hint");
  }

  goToRegister() {
    const email = this.formGroup.value.email;

    if (email) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/register"], { queryParams: { email: email } });
      return;
    }

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/register"]);
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
}
