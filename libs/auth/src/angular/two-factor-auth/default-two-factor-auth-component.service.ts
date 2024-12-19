import {
  LegacyKeyMigrationAction,
  TwoFactorAuthComponentService,
} from "./two-factor-auth-component.service";

export class DefaultTwoFactorAuthComponentService implements TwoFactorAuthComponentService {
  shouldCheckForWebauthnResponseOnInit() {
    return false;
  }

  determineLegacyKeyMigrationAction() {
    return LegacyKeyMigrationAction.PREVENT_LOGIN_AND_SHOW_REQUIRE_MIGRATION_WARNING;
  }
}
