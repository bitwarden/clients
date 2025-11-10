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
  ) {}

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

    if (!(await this.masterPasswordService.userHasMasterPassword(userId))) {
      return "noMigrationNeeded";
    }

    // Only PBKDF2 users below the minimum iteration count need migration
    const kdfConfig = await this.kdfConfigService.getKdfConfig(userId);
    if (
      kdfConfig.kdfType !== KdfType.PBKDF2_SHA256 ||
      kdfConfig.iterations >= 600000 // QA override
    ) {
      return "noMigrationNeeded";
    }

    if (!(await this.configService.getFeatureFlag(FeatureFlag.ForceUpdateKDFSettings))) {
      return "noMigrationNeeded";
    }

    return "needsMigrationWithMasterPassword";
  }
}
