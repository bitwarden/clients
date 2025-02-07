import {
  DuoLaunchAction,
  LegacyKeyMigrationAction,
  TwoFactorAuthComponentService,
} from "./two-factor-auth-component.service";

export class DefaultTwoFactorAuthComponentService implements TwoFactorAuthComponentService {
  shouldCheckForWebAuthnQueryParamResponse() {
    return false;
  }

  determineLegacyKeyMigrationAction() {
    return LegacyKeyMigrationAction.PREVENT_LOGIN_AND_SHOW_REQUIRE_MIGRATION_WARNING;
  }

  determineDuoLaunchAction(): DuoLaunchAction {
    return DuoLaunchAction.DIRECT_LAUNCH;
  }
}
