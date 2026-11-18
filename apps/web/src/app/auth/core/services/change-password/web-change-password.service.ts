import {
  ChangePasswordService,
  DefaultChangePasswordService,
  InvalidCurrentPasswordError,
} from "@bitwarden/angular/auth/password-management/change-password";
import { PasswordInputResult } from "@bitwarden/auth/angular";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { LogoutService } from "@bitwarden/common/auth/logout";
import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite";
import { assertNonNullish, assertTruthy } from "@bitwarden/common/auth/utils";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { UserKeyRotationServiceAbstraction } from "@bitwarden/user-crypto-management";
import { RouterService } from "@bitwarden/web-vault/app/core";
export class WebChangePasswordService
  extends DefaultChangePasswordService
  implements ChangePasswordService
{
  constructor(
    protected keyService: KeyService,
    protected masterPasswordApiService: MasterPasswordApiService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected masterPasswordUnlockService: MasterPasswordUnlockService,
    protected policyService: PolicyService,
    protected organizationInviteService: OrganizationInviteService,
    private syncService: SyncService,
    private userKeyRotationService: UserKeyRotationServiceAbstraction,
    private routerService: RouterService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private logoutService: LogoutService,
  ) {
    super(
      keyService,
      masterPasswordApiService,
      masterPasswordService,
      masterPasswordUnlockService,
      policyService,
      organizationInviteService,
    );
  }

  async changePasswordAndRotateUserKey(
    passwordInputResult: PasswordInputResult,
    user: Account,
  ): Promise<void> {
    const context = "Could not change password and rotate user key.";
    assertTruthy(passwordInputResult.currentPassword, "currentPassword", context);
    assertTruthy(passwordInputResult.newPassword, "newPassword", context);
    assertNonNullish(passwordInputResult.newPasswordHint, "newPasswordHint", context); // can have an empty string as a meaningful value, so check non-nullish

    const currentPasswordVerified = await this.masterPasswordUnlockService.proofOfDecryption(
      passwordInputResult.currentPassword,
      user.id,
    );
    if (!currentPasswordVerified) {
      throw new InvalidCurrentPasswordError();
    }

    await this.syncService.fullSync(true);

    const success = await this.userKeyRotationService.changePasswordAndRotateUserKey(
      passwordInputResult.currentPassword,
      passwordInputResult.newPassword,
      passwordInputResult.newPasswordHint,
      user.id,
    );
    if (!success) {
      return;
    }

    this.toastService.showToast({
      variant: "success",
      title: this.i18nService.t("rotationCompletedTitle"),
      message: this.i18nService.t("rotationCompletedDesc"),
      timeout: 15000,
    });

    // The rotation invalidates every session, this one included
    await this.logoutService.logout(user.id, "userKeyRotation");
  }

  async clearDeeplinkState() {
    await this.routerService.getAndClearLoginRedirectUrl();
  }
}
