import { CommonModule } from "@angular/common";
import { Component, Input, OnInit, output } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { LockIcon } from "@bitwarden/assets/svg";
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
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import {
  AnonLayoutWrapperDataService,
  CalloutComponent,
  DialogService,
  IconModule,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  ChangePasswordService,
  InvalidCurrentPasswordError,
} from "./change-password.service.abstraction";

/**
 * The `ChangePasswordComponent` makes use of the `InputPasswordComponent` by passing in one of the following flows:
 * - {@link InputPasswordFlow.ChangePassword}
 * - {@link InputPasswordFlow.ChangePasswordWithOptionalUserKeyRotation} (when `ChangePasswordComponent` is
 *    embedded in the `PasswordSettingsComponent`)
 *
 * Both of these flows include showing the current password field to the user.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "auth-change-password",
  templateUrl: "change-password.component.html",
  imports: [CalloutComponent, CommonModule, IconModule, InputPasswordComponent, I18nPipe],
})
export class ChangePasswordComponent implements OnInit {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() inputPasswordFlow: InputPasswordFlow = InputPasswordFlow.ChangePassword;

  passwordChanged = output<void>();

  activeAccount: Account | null = null;
  email?: string;
  userId?: UserId;
  masterPasswordPolicyOptions?: MasterPasswordPolicyOptions;
  initializing = true;
  submitting = false;
  formPromise?: Promise<any>;
  forceSetPasswordReason: ForceSetPasswordReason = ForceSetPasswordReason.None;

  protected readonly ForceSetPasswordReason = ForceSetPasswordReason;

  constructor(
    private accountService: AccountService,
    private changePasswordService: ChangePasswordService,
    private i18nService: I18nService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private organizationInviteService: OrganizationInviteService,
    private messagingService: MessagingService,
    private policyService: PolicyService,
    private toastService: ToastService,
    private syncService: SyncService,
    private dialogService: DialogService,
    private logService: LogService,
    private logoutService: LogoutService,
    private router: Router,
  ) {}

  async ngOnInit() {
    this.activeAccount = await firstValueFrom(this.accountService.activeAccount$);

    if (!this.activeAccount) {
      throw new Error("No active active account found while trying to change passwords.");
    }

    this.userId = this.activeAccount.id;
    this.email = this.activeAccount.email;

    if (!this.userId) {
      throw new Error("userId not found");
    }

    this.masterPasswordPolicyOptions = await firstValueFrom(
      this.policyService.masterPasswordPolicyOptions$(this.userId),
    );

    this.forceSetPasswordReason = await firstValueFrom(
      this.masterPasswordService.forceSetPasswordReason$(this.userId),
    );

    if (this.forceSetPasswordReason === ForceSetPasswordReason.AdminForcePasswordReset) {
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageIcon: LockIcon,
        pageTitle: { key: "updateMasterPassword" },
        pageSubtitle: { key: "accountRecoveryUpdateMasterPasswordSubtitle" },
      });
    } else if (this.forceSetPasswordReason === ForceSetPasswordReason.WeakMasterPassword) {
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageIcon: LockIcon,
        pageTitle: { key: "updateMasterPassword" },
        pageSubtitle: { key: "updateMasterPasswordSubtitle" },
        maxWidth: "lg",
      });
    }

    this.initializing = false;
  }

  async logOut() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "logOut" },
      content: { key: "logOutConfirmation" },
      acceptButtonText: { key: "logOut" },
      type: "warning",
    });

    if (confirmed) {
      await this.organizationInviteService.clearOrganizationInvitation();

      if (this.changePasswordService.clearDeeplinkState) {
        await this.changePasswordService.clearDeeplinkState();
      }

      // TODO: PM-23515 eventually use the logout service instead of messaging service once it is available without circular dependencies
      this.messagingService.send("logout");
    }
  }

  async handlePasswordFormSubmit(passwordInputResult: PasswordInputResult) {
    this.submitting = true;

    try {
      // Handle change password with user key rotation
      if (passwordInputResult.rotateUserKey) {
        if (this.activeAccount == null) {
          throw new Error("activeAccount not found");
        }

        if (passwordInputResult.newApisWithInputPasswordFlagEnabled) {
          await this.changePasswordService.changePasswordAndRotateUserKey(
            passwordInputResult,
            this.activeAccount,
          );
          this.passwordChanged.emit();
          return; // EARLY RETURN for flagged logic
        }

        if (
          passwordInputResult.currentPassword == null ||
          passwordInputResult.newPasswordHint == null
        ) {
          throw new Error("currentPassword or newPasswordHint not found");
        }

        await this.syncService.fullSync(true);

        await this.changePasswordService.rotateUserKeyMasterPasswordAndEncryptedData(
          passwordInputResult.currentPassword,
          passwordInputResult.newPassword,
          this.activeAccount,
          passwordInputResult.newPasswordHint,
        );

        this.passwordChanged.emit();
      } else {
        if (!this.userId) {
          throw new Error("userId not found");
        }

        // Handle account recovery follow-up (i.e. a user changing their own password AFTER one was set for them via account recovery)
        if (this.forceSetPasswordReason === ForceSetPasswordReason.AdminForcePasswordReset) {
          await this.changePasswordService.changePasswordForAccountRecovery(
            passwordInputResult,
            this.userId,
          );
        } else {
          // Handle either of these cases:
          // - a normal change password (with no key rotation), or
          // - a user who has ForceSetPasswordReason.WeakMasterPassword (i.e. their password does not meet org policy requirements)
          await this.changePasswordService.changePassword(passwordInputResult, this.userId);
        }

        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("masterPasswordChanged"),
        });

        this.passwordChanged.emit();

        if (passwordInputResult.newApisWithInputPasswordFlagEnabled) {
          // TODO: investigate refactoring logout and follow-up routing in https://bitwarden.atlassian.net/browse/PM-32660
          await this.logoutService.logout(this.userId);

          const shouldNavigateToRoot = this.changePasswordService.shouldNavigateToRoot();
          if (shouldNavigateToRoot) {
            // navigate to root so redirect guard can properly route next active user (account switching) or null user to correct page
            await this.router.navigate(["/"]);
          }
        } else {
          this.messagingService.send("logout");
        }

        // Close the popout if we are in a browser extension popout.
        this.changePasswordService.closeBrowserExtensionPopout?.();
      }
    } catch (error) {
      this.logService.error(error);

      if (error instanceof InvalidCurrentPasswordError) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("invalidMasterPassword"),
        });
      } else {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("errorOccurred"),
        });
      }
    } finally {
      this.submitting = false;
    }
  }

  /**
   * Shows the logout button in the case of admin force reset password or weak password upon login.
   */
  protected secondaryButtonText(): { key: string } | undefined {
    return this.forceSetPasswordReason === ForceSetPasswordReason.AdminForcePasswordReset ||
      this.forceSetPasswordReason === ForceSetPasswordReason.WeakMasterPassword
      ? { key: "logOut" }
      : undefined;
  }
}
