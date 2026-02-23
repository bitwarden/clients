import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { DeactivatedOrg } from "@bitwarden/assets/svg";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  InputPasswordComponent,
  InputPasswordFlow,
  PasswordInputResult,
} from "@bitwarden/auth/angular";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LogoutService } from "@bitwarden/auth/common";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { assertNonNullish, assertTruthy } from "@bitwarden/common/auth/utils";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { SyncService } from "@bitwarden/common/platform/sync";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import {
  AnonLayoutWrapperDataService,
  ButtonModule,
  CalloutComponent,
  DialogService,
  IconModule,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  InitializeJitPasswordCredentials,
  SetInitialPasswordCredentials,
  SetInitialPasswordService,
  SetInitialPasswordTdeOffboardingCredentials,
  SetInitialPasswordTdeUserWithPermissionCredentials,
  SetInitialPasswordUserType,
} from "./set-initial-password.service.abstraction";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  standalone: true,
  templateUrl: "set-initial-password.component.html",
  imports: [
    ButtonModule,
    CalloutComponent,
    CommonModule,
    IconModule,
    InputPasswordComponent,
    I18nPipe,
  ],
})
export class SetInitialPasswordComponent implements OnInit {
  protected inputPasswordFlow = InputPasswordFlow.SetInitialPasswordAuthedUser;

  protected email?: string;
  protected forceSetPasswordReason?: ForceSetPasswordReason;
  protected initializing = true;
  protected masterPasswordPolicyOptions: MasterPasswordPolicyOptions | null = null;
  protected orgId?: string;
  protected orgSsoIdentifier?: string;
  protected resetPasswordAutoEnroll?: boolean;
  protected submitting = false;
  protected userId?: UserId;
  protected userType?: SetInitialPasswordUserType;
  protected SetInitialPasswordUserType = SetInitialPasswordUserType;

  constructor(
    private accountService: AccountService,
    private activatedRoute: ActivatedRoute,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private keyService: KeyService,
    private logoutService: LogoutService,
    private logService: LogService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private messagingService: MessagingService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private policyApiService: PolicyApiServiceAbstraction,
    private policyService: PolicyService,
    private router: Router,
    private setInitialPasswordService: SetInitialPasswordService,
    private ssoLoginService: SsoLoginServiceAbstraction,
    private syncService: SyncService,
    private toastService: ToastService,
    private validationService: ValidationService,
    private configService: ConfigService,
  ) {}

  async ngOnInit() {
    await this.syncService.fullSync(true);

    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    this.userId = activeAccount?.id;
    this.email = activeAccount?.email;

    await this.establishUserType();
    await this.getOrgInfo();

    this.initializing = false;
  }

  protected async handlePasswordFormSubmit(passwordInputResult: PasswordInputResult) {
    this.submitting = true;

    switch (this.userType) {
      case SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER: {
        /**
         * "KM flag"   = EnableAccountEncryptionV2JitPasswordRegistration
         * "Auth flag" = PM27086_UpdateAuthenticationApisForInputPassword (checked in InputPasswordComponent and
         *                                                                 passed through via PasswordInputResult)
         *
         * Flag unwinding for this specific `case` will depend on which flag gets unwound first:
         * - If KM flag gets unwound first, remove all code (in this `case`) after the call
         *   to setInitialPasswordJitMPUserV2Encryption(), as the V2Encryption method is the
         *   end-goal for this `case`.
         * - If Auth flag gets unwound first (in PM-28143), keep the KM code & early return,
         *   but unwind the auth flagging logic and then remove the method call marked with
         *   the "Default Scenario" comment.
         */

        const accountEncryptionV2 = await this.configService.getFeatureFlag(
          FeatureFlag.EnableAccountEncryptionV2JitPasswordRegistration,
        );

        // Scenario 1: KM flag ON
        if (accountEncryptionV2) {
          await this.setInitialPasswordJitMPUserV2Encryption(passwordInputResult);
          return;
        }

        // Scenario 2: KM flag OFF, Auth flag ON
        if (passwordInputResult.newApisWithInputPasswordFlagEnabled) {
          /**
           * If the Auth flag is enabled, it means the InputPasswordComponent will not emit a newMasterKey,
           * newServerMasterKeyHash, and newLocalMasterKeyHash. So we must create them here and add them late
           * to the PasswordInputResult before calling setInitialPassword().
           *
           * This is a temporary state. The end-goal will be to use KM's V2Encryption method above.
           */
          const ctx = "Could not set initial password.";
          assertTruthy(passwordInputResult.newPassword, "newPassword", ctx);
          assertNonNullish(passwordInputResult.kdfConfig, "kdfConfig", ctx);
          assertTruthy(this.email, "email", ctx);

          const newMasterKey = await this.keyService.makeMasterKey(
            passwordInputResult.newPassword,
            this.email.trim().toLowerCase(),
            passwordInputResult.kdfConfig,
          );

          const newServerMasterKeyHash = await this.keyService.hashMasterKey(
            passwordInputResult.newPassword,
            newMasterKey,
            HashPurpose.ServerAuthorization,
          );

          const newLocalMasterKeyHash = await this.keyService.hashMasterKey(
            passwordInputResult.newPassword,
            newMasterKey,
            HashPurpose.LocalAuthorization,
          );

          passwordInputResult.newMasterKey = newMasterKey;
          passwordInputResult.newServerMasterKeyHash = newServerMasterKeyHash;
          passwordInputResult.newLocalMasterKeyHash = newLocalMasterKeyHash;

          await this.setInitialPassword(passwordInputResult); // passwordInputResult masterKey properties generated on the SetInitialPasswordComponent (just above)
          return;
        }

        // Default Scenario: both flags OFF
        await this.setInitialPassword(passwordInputResult); // passwordInputResult masterKey properties generated on the InputPasswordComponent (default)

        break;
      }
      case SetInitialPasswordUserType.TDE_ORG_USER_RESET_PASSWORD_PERMISSION_REQUIRES_MP:
        if (passwordInputResult.newApisWithInputPasswordFlagEnabled) {
          await this.setInitialPasswordTdeUserWithPermission(passwordInputResult);
          return; // EARLY RETURN for flagged logic
        }

        await this.setInitialPassword(passwordInputResult);

        break;
      case SetInitialPasswordUserType.OFFBOARDED_TDE_ORG_USER:
        await this.setInitialPasswordTdeOffboarding(passwordInputResult);
        break;
      default:
        this.logService.error(
          `Unexpected user type: ${this.userType}. Could not set initial password.`,
        );
        this.validationService.showError("Unexpected user type. Could not set initial password.");
    }
  }

  protected async logout() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "logOut" },
      content: { key: "logOutConfirmation" },
      acceptButtonText: { key: "logOut" },
      type: "warning",
    });

    if (confirmed) {
      this.messagingService.send("logout");
    }
  }

  private async establishUserType() {
    if (!this.userId) {
      throw new Error("userId not found. Could not determine user type.");
    }

    this.forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(this.userId),
    );

    if (this.forceSetPasswordReason === ForceSetPasswordReason.TdeOffboardingUntrustedDevice) {
      this.userType = SetInitialPasswordUserType.OFFBOARDED_TDE_ORG_USER_UNTRUSTED_DEVICE;
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: { key: "unableToCompleteLogin" },
        pageIcon: DeactivatedOrg,
      });
    }

    if (this.forceSetPasswordReason === ForceSetPasswordReason.SsoNewJitProvisionedUser) {
      this.userType = SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER;
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: { key: "joinOrganization" },
        pageSubtitle: { key: "finishJoiningThisOrganizationBySettingAMasterPassword" },
      });
    }

    if (
      this.forceSetPasswordReason ===
      ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission
    ) {
      this.userType = SetInitialPasswordUserType.TDE_ORG_USER_RESET_PASSWORD_PERMISSION_REQUIRES_MP;
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: { key: "setMasterPassword" },
        pageSubtitle: { key: "orgPermissionsUpdatedMustSetPassword" },
      });
    }

    if (this.forceSetPasswordReason === ForceSetPasswordReason.TdeOffboarding) {
      this.userType = SetInitialPasswordUserType.OFFBOARDED_TDE_ORG_USER;
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: { key: "setMasterPassword" },
        pageSubtitle: { key: "tdeDisabledMasterPasswordRequired" },
      });
    }

    // If we somehow end up here without a reason, navigate to root
    if (this.forceSetPasswordReason === ForceSetPasswordReason.None) {
      await this.router.navigate(["/"]);
    }
  }

  private async getOrgInfo() {
    if (!this.userId) {
      throw new Error("userId not found. Could not handle query params.");
    }

    if (this.userType === SetInitialPasswordUserType.OFFBOARDED_TDE_ORG_USER) {
      this.masterPasswordPolicyOptions =
        (await firstValueFrom(this.policyService.masterPasswordPolicyOptions$(this.userId))) ??
        null;

      return;
    }

    const qParams = await firstValueFrom(this.activatedRoute.queryParams);

    this.orgSsoIdentifier =
      qParams.identifier ??
      (await this.ssoLoginService.getActiveUserOrganizationSsoIdentifier(this.userId));

    if (this.orgSsoIdentifier != null) {
      try {
        const autoEnrollStatus = await this.organizationApiService.getAutoEnrollStatus(
          this.orgSsoIdentifier,
        );
        this.orgId = autoEnrollStatus.id;
        this.resetPasswordAutoEnroll = autoEnrollStatus.resetPasswordEnabled;
        this.masterPasswordPolicyOptions =
          await this.policyApiService.getMasterPasswordPolicyOptsForOrgUser(this.orgId);
      } catch {
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: this.i18nService.t("errorOccurred"),
        });
      }
    }
  }

  private async setInitialPasswordJitMPUserV2Encryption(passwordInputResult: PasswordInputResult) {
    const ctx = "Could not set initial password for SSO JIT master password encryption user.";
    assertTruthy(passwordInputResult.newPassword, "newPassword", ctx);
    assertTruthy(passwordInputResult.salt, "salt", ctx);
    assertTruthy(this.orgSsoIdentifier, "orgSsoIdentifier", ctx);
    assertTruthy(this.orgId, "orgId", ctx);
    assertTruthy(this.userId, "userId", ctx);
    assertNonNullish(passwordInputResult.newPasswordHint, "newPasswordHint", ctx); // can have an empty string as a valid value, so check non-nullish
    assertNonNullish(this.resetPasswordAutoEnroll, "resetPasswordAutoEnroll", ctx); // can have `false` as a valid value, so check non-nullish

    try {
      const credentials: InitializeJitPasswordCredentials = {
        newPasswordHint: passwordInputResult.newPasswordHint,
        orgSsoIdentifier: this.orgSsoIdentifier,
        orgId: this.orgId as OrganizationId,
        resetPasswordAutoEnroll: this.resetPasswordAutoEnroll,
        newPassword: passwordInputResult.newPassword,
        salt: passwordInputResult.salt,
      };

      await this.setInitialPasswordService.initializePasswordJitPasswordUserV2Encryption(
        credentials,
        this.userId,
      );

      this.showSuccessToastByUserType();

      this.submitting = false;
      await this.router.navigate(["vault"]);
    } catch (e) {
      this.logService.error("Error setting initial password", e);
      this.validationService.showError(e);
      this.submitting = false;
    }
  }

  /**
   * @deprecated To be removed in PM-28143
   */
  private async setInitialPassword(passwordInputResult: PasswordInputResult) {
    const ctx = "Could not set initial password.";
    assertTruthy(passwordInputResult.newMasterKey, "newMasterKey", ctx);
    assertTruthy(passwordInputResult.newServerMasterKeyHash, "newServerMasterKeyHash", ctx);
    assertTruthy(passwordInputResult.newLocalMasterKeyHash, "newLocalMasterKeyHash", ctx);
    assertTruthy(passwordInputResult.kdfConfig, "kdfConfig", ctx);
    assertTruthy(passwordInputResult.newPassword, "newPassword", ctx);
    assertTruthy(passwordInputResult.salt, "salt", ctx);
    assertTruthy(this.orgSsoIdentifier, "orgSsoIdentifier", ctx);
    assertTruthy(this.orgId, "orgId", ctx);
    assertTruthy(this.userType, "userType", ctx);
    assertTruthy(this.userId, "userId", ctx);
    assertNonNullish(passwordInputResult.newPasswordHint, "newPasswordHint", ctx); // can have an empty string as a valid value, so check non-nullish
    assertNonNullish(this.resetPasswordAutoEnroll, "resetPasswordAutoEnroll", ctx); // can have `false` as a valid value, so check non-nullish

    try {
      const credentials: SetInitialPasswordCredentials = {
        newMasterKey: passwordInputResult.newMasterKey,
        newServerMasterKeyHash: passwordInputResult.newServerMasterKeyHash,
        newLocalMasterKeyHash: passwordInputResult.newLocalMasterKeyHash,
        newPasswordHint: passwordInputResult.newPasswordHint,
        kdfConfig: passwordInputResult.kdfConfig,
        orgSsoIdentifier: this.orgSsoIdentifier,
        orgId: this.orgId,
        resetPasswordAutoEnroll: this.resetPasswordAutoEnroll,
        newPassword: passwordInputResult.newPassword,
        salt: passwordInputResult.salt,
      };

      await this.setInitialPasswordService.setInitialPassword(
        credentials,
        this.userType,
        this.userId,
      );

      this.showSuccessToastByUserType();

      this.submitting = false;
      await this.router.navigate(["vault"]);
    } catch (e) {
      this.logService.error("Error setting initial password", e);
      this.validationService.showError(e);
      this.submitting = false;
    }
  }

  private async setInitialPasswordTdeUserWithPermission(passwordInputResult: PasswordInputResult) {
    const ctx =
      "Could not set initial password for TDE user with Manage Account Recovery permission.";

    assertTruthy(passwordInputResult.newPassword, "newPassword", ctx);
    assertTruthy(passwordInputResult.salt, "salt", ctx);
    assertNonNullish(passwordInputResult.kdfConfig, "kdfConfig", ctx);
    assertNonNullish(passwordInputResult.newPasswordHint, "newPasswordHint", ctx); // can have an empty string as a valid value, so check non-nullish
    assertTruthy(this.orgSsoIdentifier, "orgSsoIdentifier", ctx);
    assertTruthy(this.orgId, "orgId", ctx);
    assertNonNullish(this.resetPasswordAutoEnroll, "resetPasswordAutoEnroll", ctx); // can have `false` as a valid value, so check non-nullish
    assertTruthy(this.userId, "userId", ctx);

    try {
      const credentials: SetInitialPasswordTdeUserWithPermissionCredentials = {
        newPassword: passwordInputResult.newPassword,
        salt: passwordInputResult.salt,
        kdfConfig: passwordInputResult.kdfConfig,
        newPasswordHint: passwordInputResult.newPasswordHint,
        orgSsoIdentifier: this.orgSsoIdentifier,
        orgId: this.orgId as OrganizationId,
        resetPasswordAutoEnroll: this.resetPasswordAutoEnroll,
      };

      await this.setInitialPasswordService.setInitialPasswordTdeUserWithPermission(
        credentials,
        this.userId,
      );

      this.showSuccessToastByUserType();

      this.submitting = false;
      await this.router.navigate(["vault"]);
    } catch (e) {
      this.logService.error("Error setting initial password", e);
      this.validationService.showError(e);
      this.submitting = false;
    }
  }

  private async setInitialPasswordTdeOffboarding(passwordInputResult: PasswordInputResult) {
    const ctx = "Could not set initial password.";
    assertTruthy(passwordInputResult.newMasterKey, "newMasterKey", ctx);
    assertTruthy(passwordInputResult.newServerMasterKeyHash, "newServerMasterKeyHash", ctx);
    assertTruthy(this.userId, "userId", ctx);
    assertNonNullish(passwordInputResult.newPasswordHint, "newPasswordHint", ctx); // can have an empty string as a valid value, so check non-nullish

    try {
      const credentials: SetInitialPasswordTdeOffboardingCredentials = {
        newMasterKey: passwordInputResult.newMasterKey,
        newServerMasterKeyHash: passwordInputResult.newServerMasterKeyHash,
        newPasswordHint: passwordInputResult.newPasswordHint,
      };

      await this.setInitialPasswordService.setInitialPasswordTdeOffboarding(
        credentials,
        this.userId,
      );

      this.showSuccessToastByUserType();

      await this.logoutService.logout(this.userId);
      // navigate to root so redirect guard can properly route next active user or null user to correct page
      await this.router.navigate(["/"]);
    } catch (e) {
      this.logService.error("Error setting initial password during TDE offboarding", e);
      this.validationService.showError(e);
    } finally {
      this.submitting = false;
    }
  }

  private showSuccessToastByUserType() {
    if (this.userType === SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER) {
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("accountSuccessfullyCreated"),
      });

      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("inviteAccepted"),
      });
    } else {
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("masterPasswordSuccessfullySet"),
      });
    }
  }
}
