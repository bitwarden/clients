import { Router } from "@angular/router";

import {
  LoginStrategyServiceAbstraction,
  LoginSuccessHandlerService,
  PasswordLoginCredentials,
} from "@bitwarden/auth/common";
import { ClientType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";

import { AutomationCapability } from "../automation-capability";

/**
 * Where a sign-in ended up. `TwoFactorRequired` and `DeviceVerificationRequired` open that screen;
 * `SsoRequired` and `LegacyEncryptionUnsupported` only report.
 */
export type LoginStatus =
  | "LoggedIn"
  | "TwoFactorRequired"
  | "DeviceVerificationRequired"
  | "SsoRequired"
  | "LegacyEncryptionUnsupported";

export interface LoginResult {
  status: LoginStatus;
  /** Set when `status` is `LoggedIn`. */
  userId?: UserId;
}

/**
 * Signs a logged-out account in with the login form's services, without its screens. Unlike the
 * form, it does not check an organization invite's master password policy.
 *
 * Repeats `LoginComponent`'s result handling, because login has no stream like
 * `UnlockService.unlocked$` for the form to continue from. Consider adding one, so the form and
 * this capability share a single path.
 */
export class LoginCapability extends AutomationCapability {
  readonly automationName = "login";

  constructor(
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private loginSuccessHandlerService: LoginSuccessHandlerService,
    private router: Router,
    private platformUtilsService: PlatformUtilsService,
  ) {
    super();
  }

  /**
   * Sign in with email and master password, then open the vault. A second factor or new-device
   * check opens that screen instead. Rejects on wrong credentials.
   */
  async logInWithMasterPassword(email: string, masterPassword: string): Promise<LoginResult> {
    const result = await this.loginStrategyService.logIn(
      new PasswordLoginCredentials(email, masterPassword),
    );

    if (result.requiresEncryptionKeyMigration) {
      return { status: "LegacyEncryptionUnsupported" };
    }

    if (result.requiresTwoFactor) {
      await this.router.navigate(["2fa"]);
      return { status: "TwoFactorRequired" };
    }

    if (result.requiresDeviceVerification) {
      await this.router.navigate(["device-verification"]);
      return { status: "DeviceVerificationRequired" };
    }

    if (result.requiresSso) {
      return { status: "SsoRequired" };
    }

    await this.loginSuccessHandlerService.run(result.userId, result.masterPassword);
    await this.router.navigate([
      this.platformUtilsService.getClientType() === ClientType.Browser ? "/tabs/vault" : "vault",
    ]);

    return { status: "LoggedIn", userId: result.userId };
  }
}
