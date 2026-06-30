// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, OnDestroy, OnInit, Output } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { RegistrationCheckEmailIcon } from "@bitwarden/assets/svg";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterSendVerificationEmailRequest } from "@bitwarden/common/auth/models/request/registration/register-send-verification-email.request";
import { OrgInviteKind } from "@bitwarden/common/auth/organization-invite/org-invite-kind";
import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite/organization-invite.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { RegionConfig, Region } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  ANON_LAYOUT_DEFAULTS,
  AnonLayoutWrapperDataService,
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  FormFieldModule,
  SvgModule,
  LinkModule,
} from "@bitwarden/components";

import { LoginEmailService } from "../../../common";
import { RegistrationEnvSelectorComponent } from "../registration-env-selector/registration-env-selector.component";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum RegistrationStartState {
  USER_DATA_ENTRY = "UserDataEntry",
  CHECK_EMAIL = "CheckEmail",
}

const DEFAULT_MARKETING_EMAILS_PREF_BY_REGION: Record<Region, boolean> = {
  [Region.US]: true,
  [Region.EU]: false,
  [Region.SelfHosted]: false,
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "auth-registration-start",
  templateUrl: "./registration-start.component.html",
  imports: [
    CommonModule,
    ReactiveFormsModule,
    JslibModule,
    FormFieldModule,
    AsyncActionsModule,
    CheckboxModule,
    ButtonModule,
    LinkModule,
    SvgModule,
    RegistrationEnvSelectorComponent,
  ],
})
export class RegistrationStartComponent implements OnInit, OnDestroy {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() registrationStartStateChange = new EventEmitter<RegistrationStartState>();

  state: RegistrationStartState = RegistrationStartState.USER_DATA_ENTRY;
  RegistrationStartState = RegistrationStartState;

  isSelfHost = false;

  formGroup = this.formBuilder.group({
    email: ["", [Validators.required, Validators.email]],
    name: [""],
    receiveMarketingEmails: [false],
  });

  get email() {
    return this.formGroup.controls.email;
  }

  get name() {
    return this.formGroup.controls.name;
  }

  get receiveMarketingEmails() {
    return this.formGroup.controls.receiveMarketingEmails;
  }

  emailReadonly: boolean = false;

  showErrorSummary = false;

  private destroy$ = new Subject<void>();

  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private platformUtilsService: PlatformUtilsService,
    private accountApiService: AccountApiService,
    private router: Router,
    private loginEmailService: LoginEmailService,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private organizationInviteService: OrganizationInviteService,
    private i18nService: I18nService,
    private configService: ConfigService,
  ) {
    this.isSelfHost = platformUtilsService.isSelfHost();
  }

  async ngOnInit() {
    // Emit the initial state
    this.registrationStartStateChange.emit(this.state);

    this.listenForQueryParamChanges();

    /**
     * If the user has a login email, set the email field to the login email.
     */
    this.loginEmailService.loginEmail$.pipe(takeUntil(this.destroy$)).subscribe((email) => {
      if (email) {
        this.formGroup.patchValue({ email });
      }
    });
  }

  private listenForQueryParamChanges() {
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe((qParams) => {
      if (qParams.email != null && qParams.email.indexOf("@") > -1) {
        this.email?.setValue(qParams.email);
        this.emailReadonly = qParams.emailReadonly === "true";
      }
    });
  }

  setReceiveMarketingEmailsByRegion(region: RegionConfig | typeof Region.SelfHosted) {
    let defaultValue;
    if (region === Region.SelfHosted) {
      defaultValue = DEFAULT_MARKETING_EMAILS_PREF_BY_REGION[region];
    } else {
      const regionKey = (region as RegionConfig).key;
      defaultValue = DEFAULT_MARKETING_EMAILS_PREF_BY_REGION[regionKey];
    }

    this.receiveMarketingEmails.setValue(defaultValue);
  }

  submit = async () => {
    const valid = this.validateForm();

    if (!valid) {
      return;
    }

    const emailValue = this.email.value;
    if (emailValue && !(await this.openInviteDomainAllowed(emailValue))) {
      return;
    }

    // The app expects null for name and not empty string.
    const sanitizedName = this.name.value === "" ? null : this.name.value;

    const request: RegisterSendVerificationEmailRequest = new RegisterSendVerificationEmailRequest(
      this.email.value,
      sanitizedName,
      this.receiveMarketingEmails.value,
    );

    const result = await this.accountApiService.registerSendVerificationEmail(request);

    if (typeof result === "string") {
      // we received a token, so the env doesn't support email verification
      // send the user directly to the finish registration page with the token as a query param
      await this.router.navigate(["/finish-signup"], {
        queryParams: { token: result, email: this.email.value },
      });
      return;
    }

    // Result is null, so email verification is required
    this.state = RegistrationStartState.CHECK_EMAIL;
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageTitle: {
        key: "checkYourEmail",
      },
      pageIcon: RegistrationCheckEmailIcon,
      // These four fields undo the extension SignUp route's compact/left/no-icon styling for
      // the CHECK_EMAIL screen specifically. On web/desktop these values already match the
      // wrapper defaults, so these overrides are visual no-ops. `goBack()`'s reset is
      // symmetric across all clients: in resetToCachedRouteData(), ANON_LAYOUT_DEFAULTS is
      // spread before the cached route data, so route-omitted fields get set to defaults,
      // while route-declared fields get re-applied from the cached route data.
      hidePageIcon: ANON_LAYOUT_DEFAULTS.hidePageIcon,
      heroTextAlignment: ANON_LAYOUT_DEFAULTS.heroTextAlignment,
      contentVerticalPadding: ANON_LAYOUT_DEFAULTS.contentVerticalPadding,
      footerVerticalPadding: ANON_LAYOUT_DEFAULTS.footerVerticalPadding,
    });
    this.registrationStartStateChange.emit(this.state);
  };

  handleSelectedRegionChange(region: RegionConfig | typeof Region.SelfHosted | null) {
    this.isSelfHost = region === Region.SelfHosted;

    if (region !== null) {
      this.setReceiveMarketingEmailsByRegion(region);
    }
  }

  private validateForm(): boolean {
    this.formGroup.markAllAsTouched();

    if (this.formGroup.invalid) {
      this.showErrorSummary = true;
    }

    return this.formGroup.valid;
  }

  /**
   * Pre-auth UX check for open-invite domain restrictions. When an `OpenOrganizationInvite`
   * is in state, validates the entered email's domain against the link's `AllowedDomains`
   * via the server. Sets a form-control error on the email field when the domain isn't
   * allowed and returns false; returns true in all other cases (no open invite stashed,
   * or domain allowed).
   *
   * Server-side enforcement also runs at accept time — this is layered UX, not a security
   * boundary. The submit button stays enabled so the user can correct and retry.
   */
  private async openInviteDomainAllowed(email: string): Promise<boolean> {
    const invite = await this.organizationInviteService.getOrganizationInvite();
    if (invite?.kind !== OrgInviteKind.Open) {
      return true;
    }
    // Defense in depth: even though the open-invite landing route is gated by
    // `FeatureFlag.GenerateInviteLink`, stale state from a prior flag-on session
    // could persist into a flag-off session. Skip the domain check when the
    // feature is disabled.
    if (!(await this.configService.getFeatureFlag(FeatureFlag.GenerateInviteLink))) {
      return true;
    }
    const allowed = await this.organizationInviteService.validateOpenInviteEmailDomain(
      invite.inviteLinkCode,
      email,
    );
    if (!allowed) {
      this.email.setErrors({
        error: { message: this.i18nService.t("openInviteEmailDomainNotAllowed") },
      });
    }
    return allowed;
  }

  goBack() {
    this.state = RegistrationStartState.USER_DATA_ENTRY;
    this.anonLayoutWrapperDataService.resetToCachedRouteData();
    this.registrationStartStateChange.emit(this.state);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
