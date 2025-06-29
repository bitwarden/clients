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
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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

  constructor(
    private accountService: AccountService,
    private activatedRoute: ActivatedRoute,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private dialogService: DialogService,
    private i18nService: I18nService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private messagingService: MessagingService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private policyApiService: PolicyApiServiceAbstraction,
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

    await this.determineUserType();
    await this.handleQueryParams();

    this.initializing = false;
  }

  private async determineUserType() {
    if (!this.userId) {
      throw new Error("userId not found. Could not determine user type.");
    }

    this.forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(this.userId),
    );

    if (
      this.forceSetPasswordReason ===
      ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission
    ) {
      this.userType = SetInitialPasswordUserType.TDE_ORG_USER_RESET_PASSWORD_PERMISSION_REQUIRES_MP;
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: { key: "setMasterPassword" },
        pageSubtitle: { key: "orgPermissionsUpdatedMustSetPassword" },
      });
    } else {
      this.userType = SetInitialPasswordUserType.JIT_PROVISIONED_MP_ORG_USER;
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: { key: "joinOrganization" },
        pageSubtitle: { key: "finishJoiningThisOrganizationBySettingAMasterPassword" },
      });
    }
  }

  private async handleQueryParams() {
    if (!this.userId) {
      throw new Error("userId not found. Could not handle query params.");
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

    if (!passwordInputResult.newMasterKey) {
      throw new Error("newMasterKey not found. Could not set initial password.");
    }
    if (!passwordInputResult.newServerMasterKeyHash) {
      throw new Error("newServerMasterKeyHash not found. Could not set initial password.");
    }
    if (!passwordInputResult.newLocalMasterKeyHash) {
      throw new Error("newLocalMasterKeyHash not found. Could not set initial password.");
    }
    // newPasswordHint can have an empty string as a valid value, so we specifically check for null or undefined
    if (passwordInputResult.newPasswordHint == null) {
      throw new Error("newPasswordHint not found. Could not set initial password.");
    }
    if (!passwordInputResult.kdfConfig) {
      throw new Error("kdfConfig not found. Could not set initial password.");
    }
    if (!this.userId) {
      throw new Error("userId not found. Could not set initial password.");
    }
    if (!this.userType) {
      throw new Error("userType not found. Could not set initial password.");
    }
    if (!this.orgSsoIdentifier) {
      throw new Error("orgSsoIdentifier not found. Could not set initial password.");
    }
    if (!this.orgId) {
      throw new Error("orgId not found. Could not set initial password.");
    }
    // resetPasswordAutoEnroll can have `false` as a valid value, so we specifically check for null or undefined
    if (this.resetPasswordAutoEnroll == null) {
      throw new Error("resetPasswordAutoEnroll not found. Could not set initial password.");
    }

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
    }

    if (
      this.userType ===
      SetInitialPasswordUserType.TDE_ORG_USER_RESET_PASSWORD_PERMISSION_REQUIRES_MP
    ) {
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
}
