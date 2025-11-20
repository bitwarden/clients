// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Params, Router, RouterModule } from "@angular/router";
import { Subject, firstValueFrom } from "rxjs";

import { PremiumInterestStateService } from "@bitwarden/angular/billing/services/premium-interest/premium-interest-state.service.abstraction";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterVerificationEmailClickedRequest } from "@bitwarden/common/auth/models/request/registration/register-verification-email-clicked.request";
import { HttpStatusCode } from "@bitwarden/common/enums";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { AnonLayoutWrapperDataService, ToastService } from "@bitwarden/components";

import {
  LoginStrategyServiceAbstraction,
  LoginSuccessHandlerService,
  PasswordLoginCredentials,
} from "../../../common";
import {
  InputPasswordComponent,
  InputPasswordFlow,
} from "../../input-password/input-password.component";
import { PasswordInputResult } from "../../input-password/password-input-result";

import { RegistrationFinishService } from "./registration-finish.service";

const MarketingInitiative = Object.freeze({
  Premium: "premium",
} as const);

type MarketingInitiative = (typeof MarketingInitiative)[keyof typeof MarketingInitiative];

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "auth-registration-finish",
  templateUrl: "./registration-finish.component.html",
  imports: [CommonModule, JslibModule, RouterModule, InputPasswordComponent],
})
export class RegistrationFinishComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  inputPasswordFlow = InputPasswordFlow.SetInitialPasswordAccountRegistration;
  loading = true;
  submitting = false;
  email: string;

  /**
   * Indicates that the user is coming from a marketing page designed to streamline
   * users who intend to setup a premium subscription after registration.
   */
  premiumInterest = false;

  // Note: this token is the email verification token. When it is supplied as a query param,
  // it either comes from the email verification email or, if email verification is disabled server side
  // via global settings, it comes directly from the registration-start component directly.
  // It is not provided when the user is coming from another emailed invite (ex: org invite or enterprise
  // org sponsored free family plan invite).
  emailVerificationToken: string;

  // this token is provided when the user is coming from an emailed invite to
  // setup a free family plan sponsored by an organization but they don't have an account yet.
  orgSponsoredFreeFamilyPlanToken: string;

  // this token is provided when the user is coming from an emailed invite to accept an emergency access invite
  acceptEmergencyAccessInviteToken: string;
  emergencyAccessId: string;

  // This token is provided when the user is coming from an emailed invite to accept a provider invite
  providerInviteToken: string;
  providerUserId: string;

  masterPasswordPolicyOptions: MasterPasswordPolicyOptions | null = null;

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private toastService: ToastService,
    private i18nService: I18nService,
    private registrationFinishService: RegistrationFinishService,
    private validationService: ValidationService,
    private accountApiService: AccountApiService,
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private logService: LogService,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private loginSuccessHandlerService: LoginSuccessHandlerService,
    private premiumInterestStateService: PremiumInterestStateService,
  ) {}

  async ngOnInit() {
    const qParams = await firstValueFrom(this.activatedRoute.queryParams);
    this.handleQueryParams(qParams);

    if (
      qParams.fromEmail &&
      qParams.fromEmail === "true" &&
      this.email &&
      this.emailVerificationToken
    ) {
      await this.initEmailVerificationFlow();
    } else {
      // Org Invite flow OR registration with email verification disabled Flow
      const orgInviteFlow = await this.initOrgInviteFlowIfPresent();

      if (!orgInviteFlow) {
        this.initRegistrationWithEmailVerificationDisabledFlow();
      }
    }

    this.loading = false;
  }

  private handleQueryParams(qParams: Params) {
    if (qParams.email != null && qParams.email.indexOf("@") > -1) {
      this.email = qParams.email;
    }

    if (qParams.token != null) {
      this.emailVerificationToken = qParams.token;
    }

    if (qParams.orgSponsoredFreeFamilyPlanToken != null) {
      this.orgSponsoredFreeFamilyPlanToken = qParams.orgSponsoredFreeFamilyPlanToken;
    }

    if (qParams.acceptEmergencyAccessInviteToken != null && qParams.emergencyAccessId) {
      this.acceptEmergencyAccessInviteToken = qParams.acceptEmergencyAccessInviteToken;
      this.emergencyAccessId = qParams.emergencyAccessId;
    }

    if (qParams.providerInviteToken != null && qParams.providerUserId != null) {
      this.providerInviteToken = qParams.providerInviteToken;
      this.providerUserId = qParams.providerUserId;
    }

    if (qParams.fromMarketing != null && qParams.fromMarketing === MarketingInitiative.Premium) {
      this.premiumInterest = true;
    }
  }

  private async initOrgInviteFlowIfPresent(): Promise<boolean> {
    this.masterPasswordPolicyOptions =
      await this.registrationFinishService.getMasterPasswordPolicyOptsFromOrgInvite();

    const orgName = await this.registrationFinishService.getOrgNameFromOrgInvite();
    if (orgName) {
      // Org invite exists
      // Set the page title and subtitle appropriately
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: {
          key: "joinOrganizationName",
          placeholders: [orgName],
        },
        pageSubtitle: {
          key: "finishJoiningThisOrganizationBySettingAMasterPassword",
        },
      });
      return true;
    }

    return false;
  }

  async handlePasswordFormSubmit(passwordInputResult: PasswordInputResult) {
    this.submitting = true;
    try {
      await this.registrationFinishService.finishRegistration(
        this.email,
        passwordInputResult,
        this.emailVerificationToken,
        this.orgSponsoredFreeFamilyPlanToken,
        this.acceptEmergencyAccessInviteToken,
        this.emergencyAccessId,
        this.providerInviteToken,
        this.providerUserId,
      );
    } catch (e) {
      this.validationService.showError(e);
      this.submitting = false;
      return;
    }

    // Show acct created toast
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("newAccountCreated2"),
    });

    // login with the new account
    try {
      const credentials = new PasswordLoginCredentials(this.email, passwordInputResult.newPassword);

      const authenticationResult = await this.loginStrategyService.logIn(credentials);

      if (authenticationResult?.requiresTwoFactor) {
        await this.router.navigate(["/2fa"]);
        return;
      }

      await this.loginSuccessHandlerService.run(authenticationResult.userId);

      if (this.premiumInterest) {
        await this.premiumInterestStateService.setPremiumInterest(
          authenticationResult.userId,
          true,
        );
      }

      await this.router.navigate(["/vault"]);
    } catch (e) {
      // If login errors, redirect to login page per product. Don't show error
      this.logService.error("Error logging in after registration: ", e.message);
      await this.router.navigate(["/login"], { queryParams: { email: this.email } });
    }
    this.submitting = false;
  }

  private setDefaultPageTitleAndSubtitle() {
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageTitle: {
        key: "setAStrongPassword",
      },
      pageSubtitle: {
        key: "finishCreatingYourAccountBySettingAPassword",
      },
    });
  }

  private async initEmailVerificationFlow() {
    this.setDefaultPageTitleAndSubtitle();
    await this.registerVerificationEmailClicked(this.email, this.emailVerificationToken);
  }

  private async registerVerificationEmailClicked(email: string, emailVerificationToken: string) {
    const request = new RegisterVerificationEmailClickedRequest(email, emailVerificationToken);
    try {
      const result = await this.accountApiService.registerVerificationEmailClicked(request);

      if (result == null) {
        this.toastService.showToast({
          title: null,
          message: this.i18nService.t("emailVerifiedV2"),
          variant: "success",
        });
      }
    } catch (e) {
      await this.handleRegisterVerificationEmailClickedError(e);
    }
  }

  private async handleRegisterVerificationEmailClickedError(e: unknown) {
    if (e instanceof ErrorResponse) {
      const errorResponse = e as ErrorResponse;
      switch (errorResponse.statusCode) {
        case HttpStatusCode.BadRequest: {
          if (errorResponse.message.includes("Expired link")) {
            await this.router.navigate(["/signup-link-expired"]);
          } else {
            this.validationService.showError(errorResponse);
          }

          break;
        }
        default:
          this.validationService.showError(errorResponse);
          break;
      }
    } else {
      this.validationService.showError(e);
    }
  }

  private initRegistrationWithEmailVerificationDisabledFlow() {
    this.setDefaultPageTitleAndSubtitle();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
