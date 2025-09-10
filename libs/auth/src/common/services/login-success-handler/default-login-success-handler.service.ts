import { firstValueFrom } from "rxjs";

import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
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
    private policyService: PolicyService,
    private ssoLoginService: SsoLoginServiceAbstraction,
    private syncService: SyncService,
    private userAsymmetricKeysRegenerationService: UserAsymmetricKeysRegenerationService,
    private logService: LogService,
  ) {}
  async run(userId: UserId): Promise<void> {
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

      /**
       * If this user is required to authenticate via SSO, add their email to a cache list.
       * We'll use this cache list to display ONLY the "Use single sign-on" button to the
       * user the next time they are on the /login page.
       */
      const ssoRequired = await firstValueFrom(
        this.policyService.policyAppliesToUser$(PolicyType.RequireSso, userId),
      );

      if (ssoRequired) {
        await this.ssoLoginService.addToSsoRequiredCache(ssoLoginEmail.toLowerCase());
      } else {
        /**
         * If user is not required to authenticate via SSO, remove email from the cache
         * list (if it was on the list). This is necessary because the user may have been
         * required to authenticate via SSO at some point in the past, but now their org
         * no longer requires SSO authenticaiton.
         */
        await this.ssoLoginService.removeFromSsoRequiredCacheIfPresent(ssoLoginEmail.toLowerCase());
      }
    }
  }
}
