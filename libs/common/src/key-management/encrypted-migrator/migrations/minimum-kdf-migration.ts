import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { KdfConfigService, KdfType, PBKDF2KdfConfig } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";

import { assertNonNullish } from "../../../auth/utils";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { ChangeKdfService } from "../../kdf/change-kdf.service.abstraction";
import { MasterPasswordServiceAbstraction } from "../../master-password/abstractions/master-password.service.abstraction";

import { EncryptedMigration, MigrationRequirement } from "./encrypted-migration";

/**
 * @internal
 * This migrator ensures the user's account has a minimum PBKDF2 iteration count.
 * It will update the entire account, logging out old clients if necessary.
 */
export class MinimumKdfMigration implements EncryptedMigration {
  constructor(
    private readonly kdfConfigService: KdfConfigService,
    private readonly changeKdfService: ChangeKdfService,
    private readonly logService: LogService,
    private readonly configService: ConfigService,
    private readonly masterPasswordService: MasterPasswordServiceAbstraction,
  ) { }

  async runMigrations(userId: UserId, masterPassword: string | null): Promise<void> {
    assertNonNullish(userId, "userId");
    assertNonNullish(masterPassword, "masterPassword");

    this.logService.info(
      `[MinimumKdfMigration] Updating user ${userId} to minimum PBKDF2 iteration count ${PBKDF2KdfConfig.ITERATIONS.defaultValue}`,
    );
    await this.changeKdfService.updateUserKdfParams(
      masterPassword!,
      new PBKDF2KdfConfig(600000),
      userId,
    );
    await this.kdfConfigService.setKdfConfig(userId, new PBKDF2KdfConfig(600000));
  }

  async needsMigration(userId: UserId): Promise<MigrationRequirement> {
    assertNonNullish(userId, "userId");
    this.logService.info(`[MinimumKdfMigration] Checking if user ${userId} needs KDF migration.`);

    if (!(await this.masterPasswordService.userHasMasterPassword(userId))) {
      this.logService.info("[MinimumKdfMigration] User has no master password, skipping migration.");
      return "noMigrationNeeded";
    }

    // Only PBKDF2 users below the minimum iteration count need migration
    const kdfConfig = await this.kdfConfigService.getKdfConfig(userId);
    this.logService.info("[MinimumKdfMigration] Current KDF config: " + JSON.stringify(kdfConfig));
    if (
      kdfConfig.kdfType !== KdfType.PBKDF2_SHA256 ||
      kdfConfig.iterations >= 600000 // QA override
    ) {
      this.logService.info(
        "[MinimumKdfMigration] User KDF config meets or exceeds minimum requirements, no migration needed.",
      );
      return "noMigrationNeeded";
    }

    if (!(await this.configService.getFeatureFlag(FeatureFlag.ForceUpdateKDFSettings))) {
      this.logService.info(
        "[MinimumKdfMigration] ForceUpdateKDFSettings feature flag is not enabled, skipping migration.",
      );
      return "noMigrationNeeded";
    }

    this.logService.info(
      "[MinimumKdfMigration] User KDF config below minimum requirements, migration needed.",
    );
    return "needsMigrationWithMasterPassword";
  }
}
