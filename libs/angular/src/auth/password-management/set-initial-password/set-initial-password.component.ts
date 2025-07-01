import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

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
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import {
  AnonLayoutWrapperDataService,
  CalloutComponent,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  SetInitialPasswordCredentials,
  SetInitialPasswordService,
  SetInitialPasswordTdeOffboardingCredentials,
  SetInitialPasswordUserType,
} from "./set-initial-password.service.abstraction";

@Component({
  standalone: true,
  templateUrl: "set-initial-password.component.html",
  imports: [CalloutComponent, CommonModule, InputPasswordComponent, I18nPipe],
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

  private async establishUserType() {
    if (!this.userId) {
      throw new Error("userId not found. Could not determine user type.");
    }

    this.forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(this.userId),
    );

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

  protected async handlePasswordFormSubmit(passwordInputResult: PasswordInputResult) {
    this.submitting = true;

    switch (this.userType) {
      case SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER:
      case SetInitialPasswordUserType.TDE_ORG_USER_RESET_PASSWORD_PERMISSION_REQUIRES_MP:
        await this.setInitialPassword(passwordInputResult);
        break;
      case SetInitialPasswordUserType.OFFBOARDED_TDE_ORG_USER:
        await this.setInitialPasswordTdeOffboarding(passwordInputResult);
        break;
      default:
        this.logService.error(
          `Unexpected user type: ${this.userType}. Could not set initial password.`,
        );
    }
  }

  private async setInitialPassword(passwordInputResult: PasswordInputResult) {
    const ctx = "Could not set initial password.";

    this.assertTruthy(passwordInputResult.newMasterKey, "newMasterKey", ctx);
    this.assertTruthy(passwordInputResult.newServerMasterKeyHash, "newServerMasterKeyHash", ctx);
    this.assertTruthy(passwordInputResult.newLocalMasterKeyHash, "newLocalMasterKeyHash", ctx);
    this.assertTruthy(passwordInputResult.kdfConfig, "kdfConfig", ctx);
    this.assertTruthy(this.orgSsoIdentifier, "orgSsoIdentifier", ctx);
    this.assertTruthy(this.orgId, "orgId", ctx);
    this.assertTruthy(this.userType, "userType", ctx);
    this.assertTruthy(this.userId, "userId", ctx);

    this.assertNonNullish(passwordInputResult.newPasswordHint, "newPasswordHint", ctx); // can have an empty string as a valid value, so check non-nullish
    this.assertNonNullish(this.resetPasswordAutoEnroll, "resetPasswordAutoEnroll", ctx); // can have `false` as a valid value, so check non-nullish

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
      this.validationService.showError(e);
      this.submitting = false;
    }
  }

  private async setInitialPasswordTdeOffboarding(passwordInputResult: PasswordInputResult) {
    const ctx = "Could not set initial password.";

    this.assertTruthy(passwordInputResult.newMasterKey, "newMasterKey", ctx);
    this.assertTruthy(passwordInputResult.newServerMasterKeyHash, "newServerMasterKeyHash", ctx);
    this.assertTruthy(this.userId, "userId", ctx);

    this.assertNonNullish(passwordInputResult.newPasswordHint, "newPasswordHint", ctx); // can have an empty string as a valid value, so check non-nullish

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

  /**
   * Asserts that a value is non-nullish (not null or undefined).
   * @param val the value to check
   * @param name the name of the value to include in the error message
   * @param ctx context to optionally append to the error message
   * @throws if the value is null or undefined
   *
   * @example
   *
   * ```
   *    // `newPasswordHint` can have an empty string as a valid value, so we check non-nullish
   *    this.assertNonNullish(
   *      passwordInputResult.newPasswordHint,
   *      "newPasswordHint",
   *      "Could not set initial password."
   *    );
   *    // Output error message: "newPasswordHint not found. Could not set initial password."
   * ```
   *
   * @remarks
   *
   * If you use this method repeatedly to check several values, it may help to assign any
   * additional context (`ctx`) to a variable and pass it in to each call. This prevents
   * the function call from formatting vertically in your text editor, taking up extra space.
   *
   * For example:
   * ```
   *    const ctx = "Could not set initial password.";
   *
   *    this.assertNonNullish(myValueOne, "myValueOne", ctx);
   *    this.assertNonNullish(myValueTwo, "myValueTwo", ctx);
   *    this.assertNonNullish(myValueThree, "myValueThree", ctx);
   * ```
   */
  private assertNonNullish<T>(val: T, name: string, ctx?: string): asserts val is NonNullable<T> {
    if (val == null) {
      // If context is provided, append it to the error message with a space before it.
      throw new Error(`${name} not found.${ctx ? ` ${ctx}` : ""}`);
    }
  }

  /**
   * Asserts that a value is truthy.
   * @param val the value to check
   * @param name the name of the value to include in the error message
   * @param ctx context to optionally append to the error message
   * @throws if the value is falsy (`false`, `""`, `0`, `null`, `undefined`, `void`, or `NaN`)
   *
   * @example
   *
   * ```
   *    this.assertTruthy(this.userId, "userId", "Could not set initial password.");
   *    // Output error message: "userId not found. Could not set initial password."
   * ```
   *
   * @remarks
   *
   * If you use this method repeatedly to check several values, it may help to assign any
   * additional context (`ctx`) to a variable and pass it in to each call. This prevents
   * the function call from formatting vertically in your text editor, taking up extra space.
   *
   * For example:
   * ```
   *    const ctx = "Could not set initial password.";
   *
   *    this.assertTruhy(myValueOne, "myValueOne", ctx);
   *    this.assertTruhy(myValueTwo, "myValueTwo", ctx);
   *    this.assertTruhy(myValueThree, "myValueThree", ctx);
   */
  private assertTruthy<T>(
    val: T,
    name: string,
    ctx?: string,
  ): asserts val is Exclude<T, false | "" | 0 | null | undefined | void | 0n> {
    // Because `NaN` is a value (not a type) of type 'number', that means we cannot add
    // it to the list of falsy values in the type assertion. Instead, we check for it
    // separately at runtime.
    if (!val || (typeof val === "number" && Number.isNaN(val))) {
      // If context is provided, append it to the error message with a space before it.
      throw new Error(`${name} not found.${ctx ? ` ${ctx}` : ""}`);
    }
  }
}
