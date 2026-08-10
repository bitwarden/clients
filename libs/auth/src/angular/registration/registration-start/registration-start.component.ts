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
import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { RegionConfig, Region } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
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
  [Region.Gov]: false,
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
    private validationService: ValidationService,
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

    await this.applyOpenOrgInviteTitleOverride();
  }

  /**
   * When an `OpenOrganizationInvite` is in state, override the anon-layout title to
   * "Join <organizationName>" so users see they're accepting an invite rather than
   * generic "Create account" chrome. No icon override — the existing route-data icon
   * (RegistrationUserAddIcon) is reused.
   *
   * Defense in depth: stale flag-on state may persist into a flag-off session.
   */
  private async applyOpenOrgInviteTitleOverride(): Promise<void> {
    const invite = await this.organizationInviteService.getOpenOrgInvite();
    if (invite == null) {
      return;
    }
    // TODO: clean up when FeatureFlag.GenerateInviteLink is removed — drop this
    // guard clause.
    if (!(await this.configService.getFeatureFlag(FeatureFlag.GenerateInviteLink))) {
      return;
    }
    this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
      pageTitle: { key: "joinOrganizationName", placeholders: [invite.organizationName] },
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
    if (emailValue && !(await this.openOrgInviteDomainAllowed(emailValue))) {
      return;
    }

    // The app expects null for name and not empty string.
    const sanitizedName = this.name.value === "" ? null : this.name.value;

    // TODO: clean up when FeatureFlag.GenerateInviteLink is removed — collapse to the
    // on-flag branch.
    let request: RegisterSendVerificationEmailRequest;
    if (await this.configService.getFeatureFlag(FeatureFlag.GenerateInviteLink)) {
      const sealedOpenOrgInviteData = await this.sealOpenOrgInviteIfPresent(this.email.value);
      request = new RegisterSendVerificationEmailRequest(
        this.email.value,
        sanitizedName,
        this.receiveMarketingEmails.value,
        sealedOpenOrgInviteData,
      );
    } else {
      request = new RegisterSendVerificationEmailRequest(
        this.email.value,
        sanitizedName,
        this.receiveMarketingEmails.value,
      );
    }

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
   * When an `OpenOrganizationInvite` is stashed, seals its `organizationId`,
   * `inviteLinkCode`, and `inviteKey` via the
   * organization-invite service so the sealed blob can ride the verification-email
   * URL fragment through the tab-boundary. Returns `undefined` when no open org invite is
   * stashed. The caller is responsible for feature-flag gating.
   */
  private async sealOpenOrgInviteIfPresent(email: string): Promise<string | undefined> {
    const invite = await this.organizationInviteService.getOpenOrgInvite();
    if (invite == null) {
      return undefined;
    }
    const sealed = await this.organizationInviteService.sealOpenOrgInvite(email, {
      organizationId: invite.organizationId,
      inviteLinkCode: invite.inviteLinkCode,
      inviteKey: invite.inviteKey,
    });
    return sealed ?? undefined;
  }

  /**
   * Pre-auth UX check for open-org-invite domain restrictions. When an `OpenOrganizationInvite`
   * is in state, validates the entered email's domain against the link's `AllowedDomains`
   * via the server. Handles four classified outcomes:
   *   - `allowed` / no open org invite stashed / feature off → returns true.
   *   - `not-allowed` → sets a form-control error on the email field and returns false.
   *   - `link-invalid` (server 404) → clears open-org-invite state and navigates to
   *     `/organization-invite-link-invalid` (with the org name + `returnTo=registration`)
   *     so the shared error component renders. Returns false.
   *   - `unexpected` (non-404 throw / transport failure) → surfaces the error via
   *     `ValidationService` and fails open (returns true). The accept endpoint enforces
   *     the invite validity server-side; a transient error here shouldn't block registration.
   *
   * Server-side enforcement of the allowed-domains policy also runs at accept time — this
   * pre-check is layered UX, not a security boundary. The submit button stays enabled so
   * the user can correct and retry.
   */
  private async openOrgInviteDomainAllowed(email: string): Promise<boolean> {
    const invite = await this.organizationInviteService.getOpenOrgInvite();
    if (invite == null) {
      return true;
    }
    // Defense in depth: stale flag-on state may persist into a flag-off session.
    // Skip the domain check when disabled.
    // TODO: clean up when FeatureFlag.GenerateInviteLink is removed — drop this
    // guard clause.
    if (!(await this.configService.getFeatureFlag(FeatureFlag.GenerateInviteLink))) {
      return true;
    }
    const result = await this.organizationInviteService.validateOpenOrgInviteEmailDomain(
      invite.organizationId,
      invite.inviteLinkCode,
      email,
    );
    switch (result.kind) {
      case "allowed":
        return true;
      case "not-allowed":
        this.email.setErrors({
          error: { message: this.i18nService.t("openOrgInviteEmailDomainNotAllowed") },
        });
        return false;
      case "link-invalid":
        await this.organizationInviteService.clearOpenOrgInvite();
        await this.router.navigate(["/organization-invite-link-invalid"], {
          queryParams: { orgName: invite.organizationName, returnTo: "registration" },
        });
        return false;
      case "unexpected":
        this.validationService.showError(result.errorMessage);
        return true;
    }
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
