import {
  DefaultTwoFactorAuthComponentService,
  TwoFactorAuthComponentService,
  LegacyKeyMigrationAction,
} from "@bitwarden/auth/angular";

export class WebTwoFactorAuthComponentService
  extends DefaultTwoFactorAuthComponentService
  implements TwoFactorAuthComponentService
{
  determineLegacyKeyMigrationAction(): LegacyKeyMigrationAction {
    return LegacyKeyMigrationAction.NAVIGATE_TO_MIGRATION_COMPONENT;
  }
}
