import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

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
import { CalloutComponent, DialogService, ToastService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AnonLayoutWrapperDataService } from "../../anon-layout/anon-layout-wrapper-data.service";
import {
  InputPasswordComponent,
  InputPasswordFlow,
} from "../../input-password/input-password.component";
import { PasswordInputResult } from "../../input-password/password-input-result";

import {
  SetInitialPasswordService,
  SetInitialPasswordCredentials,
  SetInitialPasswordUserType,
  SetInitialPasswordUser,
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

    if (this.userType !== SetInitialPasswordUser.OFFBOARDED_TDE_ORG_USER) {
      await this.handleQueryParams();
    }

    this.initializing = false;
  }

  private async determineUserType() {
    if (!this.userId) {
      throw new Error("userId not found. Could not determine user type.");
    }

    this.forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(this.userId),
    );

    if (this.forceSetPasswordReason === ForceSetPasswordReason.TdeOffboarding) {
      this.userType = SetInitialPasswordUser.OFFBOARDED_TDE_ORG_USER;
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: { key: "setMasterPassword" },
        pageSubtitle: { key: "tdeDisabledMasterPasswordRequired" },
      });
    } else if (
      this.forceSetPasswordReason ===
      ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission
    ) {
      this.userType = SetInitialPasswordUser.TDE_ORG_USER_ROLE_REQUIRES_MP;
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: { key: "setMasterPassword" },
        pageSubtitle: { key: "orgPermissionsUpdatedMustSetPassword" },
      });
    } else {
      this.userType = SetInitialPasswordUser.JIT_PROVISIONED_MP_ORG_USER;
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
          await this.policyApiService.getMasterPasswordPolicyOptsForOrgUser(autoEnrollStatus.id);
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

    if (
      !this.userId ||
      !this.userType ||
      !this.orgSsoIdentifier ||
      !this.orgId ||
      this.resetPasswordAutoEnroll == null
    ) {
      throw new Error(
        "userId, orgSsoIdentifier, orgId, or resetPasswordAutoEnroll not found. Could not set password.",
      );
    }
    if (
      this.userType === SetInitialPasswordUser.JIT_PROVISIONED_MP_ORG_USER ||
      this.userType === SetInitialPasswordUser.TDE_ORG_USER_ROLE_REQUIRES_MP
    ) {
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

        if (this.userType === SetInitialPasswordUser.JIT_PROVISIONED_MP_ORG_USER) {
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

        if (this.userType === SetInitialPasswordUser.TDE_ORG_USER_ROLE_REQUIRES_MP) {
          this.toastService.showToast({
            variant: "success",
            title: "",
            message: this.i18nService.t("masterPasswordSuccessfullySet"),
          });
        }

        this.submitting = false;
        await this.router.navigate(["vault"]);
      } catch (e) {
        this.validationService.showError(e);
        this.submitting = false;
      }

      return;
    }

    if (this.userType === SetInitialPasswordUser.OFFBOARDED_TDE_ORG_USER) {
      try {
        await this.setInitialPasswordService.setInitialPasswordTdeOffboarding(
          passwordInputResult,
          this.userId,
        );

        this.toastService.showToast({
          variant: "success",
          title: "",
          message: this.i18nService.t("masterPasswordSuccessfullySet"),
        });

        this.submitting = false;
        // TODO-rr-bw: logout user?
      } catch (e) {
        this.validationService.showError(e);
        this.submitting = false;
      }

      return;
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
