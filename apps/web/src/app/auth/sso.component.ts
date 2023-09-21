import { Component } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { SsoComponent as BaseSsoComponent } from "@bitwarden/angular/auth/components/sso.component";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrgDomainApiServiceAbstraction } from "@bitwarden/common/abstractions/organization-domain/org-domain-api.service.abstraction";
import { OrganizationDomainSsoDetailsResponse } from "@bitwarden/common/abstractions/organization-domain/responses/organization-domain-sso-details.response";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { LoginService } from "@bitwarden/common/auth/abstractions/login.service";
import { HttpStatusCode } from "@bitwarden/common/enums";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";

@Component({
  selector: "app-sso",
  templateUrl: "sso.component.html",
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
export class SsoComponent extends BaseSsoComponent {
  constructor(
    authService: AuthService,
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
    private loginService: LoginService,
    private validationService: ValidationService,
    configService: ConfigServiceAbstraction
  ) {
    super(
      authService,
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
      configService
    );
    this.redirectUri = window.location.origin + "/sso-connector.html";
    this.clientId = "web";
  }

  async ngOnInit() {
    super.ngOnInit();

    // if we have an emergency access invite, redirect to emergency access
    const emergencyAccessInvite = await this.stateService.getEmergencyAccessInvitation();
    if (emergencyAccessInvite != null) {
      this.onSuccessfulLoginNavigate = async () => {
        this.router.navigate(["/accept-emergency"], {
          queryParams: {
            id: emergencyAccessInvite.id,
            name: emergencyAccessInvite.name,
            email: emergencyAccessInvite.email,
            token: emergencyAccessInvite.token,
          },
        });
      };
    }

    // eslint-disable-next-line rxjs-angular/prefer-takeuntil, rxjs/no-async-subscribe
    this.route.queryParams.pipe(first()).subscribe(async (qParams) => {
      if (qParams.identifier != null) {
        // SSO Org Identifier in query params takes precedence over claimed domains
        this.identifier = qParams.identifier;
      } else {
        // Note: this flow is written for web but both browser and desktop
        // redirect here on SSO button click.

        // Check if email matches any claimed domains
        if (qParams.email) {
          // show loading spinner
          this.loggingIn = true;
          try {
            const response: OrganizationDomainSsoDetailsResponse =
              await this.orgDomainApiService.getClaimedOrgDomainByEmail(qParams.email);

            if (response?.ssoAvailable) {
              this.identifier = response.organizationIdentifier;
              await this.submit();
              return;
            }
          } catch (error) {
            this.handleGetClaimedDomainByEmailError(error);
          }

          this.loggingIn = false;
        }

        // Fallback to state svc if domain is unclaimed
        const storedIdentifier = await this.stateService.getSsoOrgIdentifier();
        if (storedIdentifier != null) {
          this.identifier = storedIdentifier;
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

  async submit() {
    await this.stateService.setSsoOrganizationIdentifier(this.identifier);
    if (this.clientId === "browser") {
      document.cookie = `ssoHandOffMessage=${this.i18nService.t("ssoHandOff")};SameSite=strict`;
    }
    super.submit();
  }
}
