// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit, signal } from "@angular/core";
import { ActivatedRoute, Params, Router, RouterModule } from "@angular/router";
import { Subject, firstValueFrom } from "rxjs";

import { AuthRoute } from "@bitwarden/angular/auth/constants";
import { getOpenOrgInviteStatusErrorUi } from "@bitwarden/angular/auth/organization-invite";
import { PremiumInterestStateService } from "@bitwarden/angular/billing/services/premium-interest/premium-interest-state.service.abstraction";
import { JslibModule } from "@bitwarden/angular/jslib.module";
import { TwoFactorTimeoutIcon } from "@bitwarden/assets/svg";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { DeepLinkRedirectService } from "@bitwarden/common/auth/deep-link-redirect";
import { RegisterVerificationEmailClickedRequest } from "@bitwarden/common/auth/models/request/registration/register-verification-email-clicked.request";
import {
  OpenOrganizationInvite,
  OpenOrgInviteLinkData,
  OrganizationInviteService,
  OpenOrgInviteUnsealError,
} from "@bitwarden/common/auth/organization-invite";
import { HttpStatusCode } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  AnonLayoutWrapperDataService,
  ButtonModule,
  ToastService,
  IconModule,
} from "@bitwarden/components";

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

/**
 * Discriminated render state for `RegistrationFinishComponent`. Exactly one kind is
 * active at a time — the template `@switch (viewState())` renders the matching branch,
 * so mutual exclusion between "form", "spinner", and the error state is enforced by the
 * type rather than by disciplined use of parallel boolean flags.
 *
 * `Error` is the shared terminal-failure state for both the sealed-blob unseal path and
 * the open-org-invite status-endpoint path. The specific title + icon come from
 * `anonLayoutWrapperDataService.setAnonLayoutWrapperData(...)`; the body copy comes from
 * `errorMessageI18nKey()`.
 */
export const RegistrationFinishViewState = Object.freeze({
  Loading: "loading",
  Error: "error",
  PasswordForm: "password-form",
} as const);
export type RegistrationFinishViewState =
  (typeof RegistrationFinishViewState)[keyof typeof RegistrationFinishViewState];

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "auth-registration-finish",
  templateUrl: "./registration-finish.component.html",
  imports: [
    CommonModule,
    JslibModule,
    RouterModule,
    InputPasswordComponent,
    ButtonModule,
    IconModule,
  ],
})
export class RegistrationFinishComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  inputPasswordFlow = InputPasswordFlow.SetInitialPasswordAccountRegistration;
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

  // Sealed open-org-invite blob carried on the verification-email URL when the registrant
  // reached this flow from an open-org-invite link. Extracted from the URL, unsealed in
  // ngOnInit, then dropped from the URL so page reloads cannot re-fire the single-use
  // crossing. `unsealedOpenOrgInvite` below holds the hydrated result.
  sealedOpenOrgInviteData: string | null = null;

  // Populated on `ngOnInit` when the sealed blob unseals + status-hydrates successfully.
  // Held on the component so `handlePasswordFormSubmit` can reconstruct the direct-landing
  // URL (`/join/:organizationId/:inviteLinkCode?key=<key>`) for the post-login deep-link
  // replay without re-reading state.
  unsealedOpenOrgInvite: OpenOrganizationInvite | null = null;

  // Template access to the view-state kinds so the `@switch` cases below can compare
  // against symbolic references (`RegistrationFinishViewState.Loading`) instead of
  // magic-string literals — same pattern as `LoginComponent` / `LoginUiState`.
  protected readonly RegistrationFinishViewState = RegistrationFinishViewState;

  // Discriminated render state (see {@link RegistrationFinishViewState}). Initial value
  // is `Loading` so the spinner renders while `ngOnInit` runs; the final transition to
  // `PasswordForm` or one of the error kinds happens at the end of `ngOnInit`.
  protected readonly viewState = signal<RegistrationFinishViewState>(
    RegistrationFinishViewState.Loading,
  );

  // Body-message i18n key rendered by the `Error` view state. Empty string is only
  // observable when `viewState()` is not `'error'`, in which case the template never
  // reads this — the mutual exclusion is enforced by the discriminated view state rather
  // than by parallel independent flags.
  protected readonly errorMessageI18nKey = signal<string>("");

  // Narrowed to `go-to-login` — every mapper call here passes `isAuthed: false`, which
  // pins the button. Runtime guard is at the assignment site.
  protected readonly errorButton = signal<{
    kind: "go-to-login";
    labelI18nKey: "goToLogin";
    navigateTo: `/${typeof AuthRoute.Login}`;
  } | null>(null);

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
    private deepLinkRedirectService: DeepLinkRedirectService,
    private organizationInviteService: OrganizationInviteService,
    private configService: ConfigService,
  ) {}

  async ngOnInit() {
    const qParams = await firstValueFrom(this.activatedRoute.queryParams);
    this.handleQueryParams(qParams);

    // Precondition: hydrate open-org-invite state from the sealed URL blob before dispatch.
    // Runs first so a sealed-data variant doesn't fall through to the plain email-verification
    // path (which would leave invite state empty and skip MP policy enforcement). On failure,
    // a classified error UI is already rendered — bail.
    if (!(await this.tryHydrateOpenInviteFromSealedData())) {
      return;
    }

    // Dispatch: prefer an invite in state (direct or open — `initOrgInviteFlowIfPresent`
    // reads whichever kind is stashed). Otherwise fall through to the qParams-driven
    // email-verification vs. no-verification paths.
    const invitePresent = await this.initOrgInviteFlowIfPresent();
    const fromEmailLink = this.arrivedViaEmailVerificationLink(qParams);

    if (!invitePresent && fromEmailLink) {
      await this.initEmailVerificationFlow();
    } else if (!invitePresent) {
      this.initRegistrationWithEmailVerificationDisabledFlow();
    } else if (fromEmailLink) {
      // Invite path + came-from-email link: also ping the verification-click endpoint
      // so the server marks the email verified. The invite-flow branch itself doesn't
      // fire this.
      await this.registerVerificationEmailClicked(this.email, this.emailVerificationToken);
    }

    this.viewState.set(RegistrationFinishViewState.PasswordForm);
  }

  /**
   * True when the current render is the aftermath of the user opening a
   * registration-verification email link (URL carries `fromEmail=true` alongside `email`
   * and `token`).
   */
  private arrivedViaEmailVerificationLink(qParams: Params): boolean {
    return qParams.fromEmail === "true" && !!this.email && !!this.emailVerificationToken;
  }

  /**
   * Orchestrates the open-org-invite registration crossing when the URL carries a sealed
   * open org invite blob:
   *   1. Unseal the URL link data from the sealed blob (crypto-only).
   *   2. Freshen the invite via the anonymous status endpoint.
   *   3. On success, persist the hydrated `OpenOrganizationInvite` to invite state
   *   4. On any classified failure, set the matching template signal so the form is
   *      swapped out for an inline error block.
   *
   * Both single-use inputs (the sealed secret in state and the sealed URL blob) are
   * invalidated before any error return so a refresh or back-nav can't retry.
   *
   * @returns `true` when the caller should continue (nothing to hydrate, or hydration
   *   succeeded); `false` when a classified failure UI has been rendered and the caller
   *   must short-circuit.
   */
  private async tryHydrateOpenInviteFromSealedData(): Promise<boolean> {
    if (this.sealedOpenOrgInviteData == null || !this.email) {
      return true;
    }
    // Defense in depth: stale flag-on state may persist into a flag-off session
    // (the email link is delivered before the user clicks). Skip the unseal when
    // disabled — caller falls through to the plain registration path.
    // TODO: clean up when FeatureFlag.GenerateInviteLink is removed — drop this
    // guard clause.
    if (!(await this.configService.getFeatureFlag(FeatureFlag.GenerateInviteLink))) {
      return true;
    }

    const unsealResult = await this.organizationInviteService.unsealOpenOrgInvite(
      this.email,
      this.sealedOpenOrgInviteData,
    );
    // Both single-use — invalidate before any early return so refresh/back-nav can't retry.
    await this.organizationInviteService.clearSealedOpenOrgInviteSecret(this.email);
    await this.stripSealedOpenOrgInviteDataFromUrl();

    if (unsealResult.kind !== "ok") {
      this.logOpenOrgInviteUnsealError(unsealResult);
      this.showSealedOpenOrgInviteDecryptionFailed();
      return false;
    }

    const linkData: OpenOrgInviteLinkData = unsealResult.invite;
    const statusResult = await this.organizationInviteService.getOpenOrgInviteStatus(
      linkData.organizationId,
      linkData.inviteLinkCode,
    );

    if (statusResult.kind !== "ok") {
      if (statusResult.kind === "unexpected") {
        this.logService.error(
          `RegistrationFinishComponent: open-org-invite status fetch failed: ${statusResult.errorMessage}`,
        );
      }
      const statusErrorUi = getOpenOrgInviteStatusErrorUi(statusResult.kind, false);
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData(statusErrorUi.anonLayoutData);
      this.errorMessageI18nKey.set(statusErrorUi.bodyMessageI18nKey);
      // Runtime guard on the narrowed signal: `isAuthed: false` above pins the mapper's
      // button to `go-to-login`. Any other kind here signals a mapper contract change
      // and gets logged + skipped rather than crashing the error render.
      if (statusErrorUi.button.kind === "go-to-login") {
        this.errorButton.set(statusErrorUi.button);
      } else {
        this.logService.error(
          `RegistrationFinishComponent: unexpected mapper button kind '${statusErrorUi.button.kind}' — expected 'go-to-login'.`,
        );
      }
      this.viewState.set(RegistrationFinishViewState.Error);
      return false;
    }

    const invite = OpenOrganizationInvite.fromLinkDataAndStatus(linkData, statusResult.status);
    await this.organizationInviteService.setOrganizationInvite(invite);
    this.unsealedOpenOrgInvite = invite;
    return true;
  }

  private logOpenOrgInviteUnsealError(result: OpenOrgInviteUnsealError): void {
    switch (result.kind) {
      case "secret-miss":
        this.logService.warning(
          "RegistrationFinishComponent: no HighEntropySecret stored for email during open-org-invite handoff.",
        );
        return;
      case "crypto-failure":
        this.logService.error(
          "RegistrationFinishComponent: SDK crypto failure unsealing open-org-invite.",
        );
        return;
      case "unexpected":
        this.logService.error(
          `RegistrationFinishComponent: unexpected open-org-invite unseal failure: ${result.errorMessage}`,
        );
        return;
    }
  }

  private async stripSealedOpenOrgInviteDataFromUrl(): Promise<void> {
    // `queryParamsHandling: 'merge'` + null-valued key removes only the sealed blob,
    // leaving `email`, `token`, and `fromEmail` intact so post-refresh routing still
    // works. `replaceUrl: true` avoids growing the history stack.
    await this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { sealedOpenOrgInviteData: null },
      queryParamsHandling: "merge",
      replaceUrl: true,
    });
  }

  private showSealedOpenOrgInviteDecryptionFailed(): void {
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageTitle: { key: "registrationSealedOpenOrgInviteDecryptionFailedTitle" },
      pageIcon: TwoFactorTimeoutIcon, // TODO: discuss clarity of this icon + consider renaming it
    });
    this.errorMessageI18nKey.set("registrationSealedOpenOrgInviteDecryptionFailedMessage");
    this.errorButton.set({
      kind: "go-to-login",
      labelI18nKey: "goToLogin",
      navigateTo: `/${AuthRoute.Login}`,
    });
    this.viewState.set(RegistrationFinishViewState.Error);
  }

  protected async onErrorButtonClick(): Promise<void> {
    const button = this.errorButton();
    if (button == null) {
      return;
    }
    await this.router.navigate([button.navigateTo]);
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

    if (qParams.sealedOpenOrgInviteData != null && qParams.sealedOpenOrgInviteData !== "") {
      this.sealedOpenOrgInviteData = qParams.sealedOpenOrgInviteData;
    }
  }

  private async initOrgInviteFlowIfPresent(): Promise<boolean> {
    const orgInvite = await this.organizationInviteService.getOrganizationInvite();
    if (orgInvite == null) {
      return false;
    }

    this.masterPasswordPolicyOptions =
      (await this.organizationInviteService.getMasterPasswordPolicyOptionsForInvite(orgInvite)) ??
      null;

    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageTitle: {
        key: "joinOrganizationName",
        placeholders: [orgInvite.organizationName],
      },
      pageSubtitle: {
        key: "finishJoiningThisOrganizationBySettingAMasterPassword",
      },
    });
    return true;
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
      const error = e?.message === "Expired token." ? this.i18nService.t("inviteAcceptFailed") : e;

      this.validationService.showError(error);
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

      // Persist before login so the deep-link guard on `/vault` replays this once auth
      // completes — pipes the redirect through 2FA, set-initial-password, and any other
      // intermediate auth stops without threading state through each.
      if (this.unsealedOpenOrgInvite != null) {
        const { organizationId, inviteLinkCode, inviteKey } = this.unsealedOpenOrgInvite;
        await this.deepLinkRedirectService.persistPostLoginRedirectUrl(
          `/join/${encodeURIComponent(organizationId)}/${encodeURIComponent(inviteLinkCode)}?key=${encodeURIComponent(inviteKey)}`,
        );
      }

      const authenticationResult = await this.loginStrategyService.logIn(credentials);

      // 2FA is reachable on a freshly-created account when the joining org enables email 2FA
      // at account creation via policy (direct-invite path). The deep-link persistence above
      // handles the open-org-invite path: `/2fa` completes to `/vault`, firing the guard replay.
      if (authenticationResult?.requiresTwoFactor) {
        await this.router.navigate(["/2fa"]);
        return;
      }

      await this.loginSuccessHandlerService.run(
        authenticationResult.userId,
        authenticationResult.masterPassword ?? null,
      );

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
