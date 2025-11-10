/* eslint-disable no-console */
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { UserId } from "@bitwarden/common/types/guid";
import { UserAsymmetricKeysRegenerationService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { LoginSuccessHandlerService } from "../../abstractions/login-success-handler.service";
import { LoginEmailService } from "../login-email/login-email.service";

export class DefaultLoginSuccessHandlerService implements LoginSuccessHandlerService {
  constructor(
    private configService: ConfigService,
    private loginEmailService: LoginEmailService,
    private ssoLoginService: SsoLoginServiceAbstraction,
    private syncService: SyncService,
    private userAsymmetricKeysRegenerationService: UserAsymmetricKeysRegenerationService,
    private logService: LogService,
  ) {}
  async run(userId: UserId): Promise<void> {
    // ⏱️ END TIMING - About to call /sync
    console.log("");
    performance.mark("before-sync-call");
    console.timeEnd("⏱️ Token→Sync Processing Time");

    // Calculate and display the duration
    try {
      const measure = performance.measure(
        "token-to-sync-duration",
        "token-response-received",
        "before-sync-call",
      );
      console.log(
        `%c📊 Time between /connect/token response and /sync call: ${measure.duration.toFixed(2)}ms`,
        "color: #27AE60; font-weight: bold; font-size: 14px",
      );
    } catch (e) {
      // Performance marks might not exist in some scenarios (e.g., 2FA flow)
    }

    console.log("");
    console.log("%c🌐 POST /sync - Starting call now...", "color: #95A5A6");

    // This is where /sync is actually called - we don't time this
    await this.syncService.fullSync(true, { skipTokenRefresh: true });
    await this.userAsymmetricKeysRegenerationService.regenerateIfNeeded(userId);
    await this.loginEmailService.clearLoginEmail();

    const disableAlternateLoginMethodsFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM22110_DisableAlternateLoginMethods,
    );

    if (disableAlternateLoginMethodsFlagEnabled) {
      const ssoLoginEmail = await this.ssoLoginService.getSsoEmail();

      if (!ssoLoginEmail) {
        this.logService.error("SSO login email not found.");
        return;
      }

      await this.ssoLoginService.updateSsoRequiredCache(ssoLoginEmail, userId);
      await this.ssoLoginService.clearSsoEmail();
    }
  }
}
