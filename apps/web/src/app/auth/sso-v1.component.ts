// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { first } from "rxjs/operators";

import { SsoComponent as BaseSsoComponent } from "@bitwarden/angular/auth/components/sso.component";
import {
  LoginStrategyServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization-domain/org-domain-api.service.abstraction";
import { OrganizationDomainSsoDetailsResponse } from "@bitwarden/common/admin-console/abstractions/organization-domain/responses/organization-domain-sso-details.response";
import { VerifiedOrganizationDomainSsoDetailsResponse } from "@bitwarden/common/admin-console/abstractions/organization-domain/responses/verified-organization-domain-sso-details.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { HttpStatusCode } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

@Component({
  selector: "app-sso",
  templateUrl: "sso-v1.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class SsoComponentV1 extends BaseSsoComponent implements OnInit {
  protected formGroup = new FormGroup({
    identifier: new FormControl(null, [Validators.required]),
  });

  get identifierFormControl() {
    return this.formGroup.controls.identifier;
  }

  constructor(
    ssoLoginService: SsoLoginServiceAbstraction,
    loginStrategyService: LoginStrategyServiceAbstraction,
    router: Router,
    i18nService: I18nService,
    route: ActivatedRoute,
    stateService: StateService,
    platformUtilsService: PlatformUtilsService,
    apiService: ApiService,
    cryptoFunctionService: CryptoFunctionService,
    environmentService: EnvironmentService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    logService: LogService,
    private orgDomainApiService: OrgDomainApiServiceAbstraction,
    private validationService: ValidationService,
    userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    configService: ConfigService,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    accountService: AccountService,
    toastService: ToastService,
  ) {
    super(
      ssoLoginService,
      loginStrategyService,
      router,
      i18nService,
      route,
      stateService,
      platformUtilsService,
      apiService,
      cryptoFunctionService,
      environmentService,
      passwordGenerationService,
      logService,
      userDecryptionOptionsService,
      configService,
      masterPasswordService,
      accountService,
      toastService,
    );
    this.redirectUri = window.location.origin + "/sso-connector.html";
    this.clientId = "web";
  }

  async ngOnInit() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    super.ngOnInit();

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      if (qParams.identifier != null) {
        // SSO Org Identifier in query params takes precedence over claimed domains
        this.identifierFormControl.setValue(qParams.identifier);
        this.loggingIn = true;
        await this.submit();
      } else {
        // Note: this flow is written for web but both browser and desktop
        // redirect here on SSO button click.

        // Check if email matches any claimed domains
        if (qParams.email) {
          // show loading spinner
          this.loggingIn = true;
          try {
            if (await this.configService.getFeatureFlag(FeatureFlag.VerifiedSsoDomainEndpoint)) {
              const response: ListResponse<VerifiedOrganizationDomainSsoDetailsResponse> =
                await this.orgDomainApiService.getVerifiedOrgDomainsByEmail(qParams.email);

              if (response.data.length > 0) {
                this.identifierFormControl.setValue(response.data[0].organizationIdentifier);
                await this.submit();
                return;
              }
            } else {
              const response: OrganizationDomainSsoDetailsResponse =
                await this.orgDomainApiService.getClaimedOrgDomainByEmail(qParams.email);

              if (response?.ssoAvailable && response?.verifiedDate) {
                this.identifierFormControl.setValue(response.organizationIdentifier);
                await this.submit();
                return;
              }
            }
          } catch (error) {
            this.handleGetClaimedDomainByEmailError(error);
          }

          this.loggingIn = false;
        }

        // Fallback to state svc if domain is unclaimed
        const storedIdentifier = await this.ssoLoginService.getOrganizationSsoIdentifier();
        if (storedIdentifier != null) {
          this.identifierFormControl.setValue(storedIdentifier);
        }
      }
    });
  }

  private handleGetClaimedDomainByEmailError(error: any): void {
    if (error instanceof ErrorResponse) {
      const errorResponse: ErrorResponse = error as ErrorResponse;
      switch (errorResponse.statusCode) {
        case HttpStatusCode.NotFound:
          //this is a valid case for a domain not found
          return;

        default:
          this.validationService.showError(errorResponse);
          break;
      }
    }
  }

  submit = async () => {
    if (this.formGroup.invalid) {
      return;
    }

    const autoSubmit = (await firstValueFrom(this.route.queryParams)).identifier != null;

    this.identifier = this.identifierFormControl.value;
    await this.ssoLoginService.setOrganizationSsoIdentifier(this.identifier);
    if (this.clientId === "browser") {
      document.cookie = `ssoHandOffMessage=${this.i18nService.t("ssoHandOff")};SameSite=strict`;
    }
    try {
      await Object.getPrototypeOf(this).submit.call(this);
    } catch (error) {
      if (autoSubmit) {
        await this.router.navigate(["/login"]);
      } else {
        this.validationService.showError(error);
      }
    }
  };
}
