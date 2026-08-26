// eslint-disable-next-line no-restricted-imports
import { KdfConfigService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { KdfType, PBKDF2KdfConfig } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";

import { assertNonNullish } from "../../../auth/utils";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { SyncService } from "../../../platform/sync";
import { UserId } from "../../../types/guid";
import {
  InternalMasterPasswordServiceAbstraction,
  syncLegacyMasterKeyState,
} from "../../master-password/abstractions/master-password.service.abstraction";
import { withPasswordManagerSdk } from "../../utils";

import { EncryptedMigration, MigrationRequirement } from "./encrypted-migration";

/**
 * @internal
 * This migrator ensures the user's account has a minimum PBKDF2 iteration count.
 * It will update the entire account, logging out old clients if necessary.
 */
export class MinimumKdfMigration implements EncryptedMigration {
  constructor(
    private readonly kdfConfigService: KdfConfigService,
    private readonly sdkService: SdkService,
    private readonly logService: LogService,
    private readonly configService: ConfigService,
    private readonly masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private readonly syncService: SyncService,
  ) {}

  async runMigrations(userId: UserId, masterPassword: string | null): Promise<void> {
    assertNonNullish(userId, "userId");
    assertNonNullish(masterPassword, "masterPassword");

    const kdf = new PBKDF2KdfConfig(PBKDF2KdfConfig.ITERATIONS.min);

    this.logService.info(
      `[MinimumKdfMigration] Updating user ${userId} to minimum PBKDF2 iteration count ${PBKDF2KdfConfig.ITERATIONS.defaultValue}`,
    );

    await withPasswordManagerSdk(userId, this.sdkService, async (sdk) => {
      await sdk.user_crypto_management().change_kdf(masterPassword!, kdf.toSdkConfig());
    });
    await syncLegacyMasterKeyState(userId, masterPassword!, this.masterPasswordService);
  }

  async needsMigration(userId: UserId): Promise<MigrationRequirement> {
    assertNonNullish(userId, "userId");

    if (!(await this.masterPasswordService.userHasMasterPassword(userId))) {
      return "noMigrationNeeded";
    }

    if (!(await this.localStateNeedsMigration(userId))) {
      return "noMigrationNeeded";
    }

    if (!(await this.configService.getFeatureFlag(FeatureFlag.ForceUpdateKDFSettings))) {
      return "noMigrationNeeded";
    }

    // This will be replaced by a separate API call that provides the user decryption options.
    // This may have a race condition with account switching, since runMigrations is bound to a user-id, but
    // sync-service takes the active user-id from state. It ensures we have the latest data from the server.
    // It is possible that the current client was offline while the migration happened. This would cause the
    // local state to still have the old KDF values and prompt another time.
    await this.syncService.fullSync(false);
    if (!(await this.localStateNeedsMigration(userId))) {
      this.logService.info(
        `[MinimumKdfMigration] After syncing, user ${userId} does not need migration anymore. This means the migration was likely already performed on another client!`,
      );
      return "noMigrationNeeded";
    } else {
      return "needsMigrationWithMasterPassword";
    }
  }

  private async localStateNeedsMigration(userId: UserId): Promise<boolean> {
    const kdfConfig = await this.kdfConfigService.getKdfConfig(userId);
    // Only PBKDF2 users below the minimum iteration count need migration
    return (
      kdfConfig.kdfType === KdfType.PBKDF2_SHA256 &&
      kdfConfig.iterations < PBKDF2KdfConfig.ITERATIONS.min
    );
  }
}
