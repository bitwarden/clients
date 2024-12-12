import {
  LegacyKeyMigrationAction,
  TwoFactorAuthComponentService,
} from "./two-factor-auth-component.service";

export class DefaultTwoFactorAuthComponentService implements TwoFactorAuthComponentService {
  determineLegacyKeyMigrationAction() {
    return LegacyKeyMigrationAction.PREVENT_LOGIN_AND_SHOW_REQUIRE_MIGRATION_WARNING;
  }
}
