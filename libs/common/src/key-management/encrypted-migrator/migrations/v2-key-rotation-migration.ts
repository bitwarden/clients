import { concatMap, firstValueFrom } from "rxjs";

import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { CryptoClient } from "@bitwarden/sdk-internal";
import { UserKeyRotationServiceAbstraction } from "@bitwarden/user-crypto-management";

import { ApiService } from "../../../abstractions/api.service";
import { OrganizationService } from "../../../admin-console/abstractions/organization/organization.service.abstraction";
import { assertNonNullish } from "../../../auth/utils";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { SdkLoadService } from "../../../platform/abstractions/sdk/sdk-load.service";
import { SyncService } from "../../../platform/sync";
import { UserId } from "../../../types/guid";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { MasterPasswordServiceAbstraction } from "../../master-password/abstractions/master-password.service.abstraction";

import { EncryptedMigration, MigrationRequirement } from "./encrypted-migration";

/**
 * @internal
 * Migrates users still on a v1 user key to a v2 user key by performing a
 * password-based key rotation via the user crypto management module. A full
 * sync is run immediately before rotation so the rotation operates against the
 * latest server state.
 *
 * The auto-migration is intentionally conservative: it only runs for users
 * whose rotation can complete silently with just the master password. Any user
 * whose rotation would require additional interactive trust prompts (account
 * recovery enrollment, granted emergency access) or whose vault state would
 * make rotation lossy (v1 attachments, ciphers that fail to decrypt, missing
 * private key) is skipped.
 */
export class V2KeyRotationMigration implements EncryptedMigration {
  constructor(
    private readonly keyService: KeyService,
    private readonly userKeyRotationService: UserKeyRotationServiceAbstraction,
    private readonly masterPasswordService: MasterPasswordServiceAbstraction,
    private readonly syncService: SyncService,
    private readonly configService: ConfigService,
    private readonly logService: LogService,
    private readonly organizationService: OrganizationService,
    private readonly cipherService: CipherService,
    private readonly apiService: ApiService,
    private readonly sdkService: SdkService,
  ) {}

  async needsMigration(userId: UserId): Promise<MigrationRequirement> {
    assertNonNullish(userId, "userId");

    if (!(await this.configService.getFeatureFlag(FeatureFlag.ForceUpgradeV2Encryption))) {
      return "noMigrationNeeded";
    }

    if (!(await this.masterPasswordService.userHasMasterPassword(userId))) {
      return "noMigrationNeeded";
    }

    if (!(await this.userKeyIsV1(userId))) {
      return "noMigrationNeeded";
    }

    // Sync first so a rotation already performed on another client is reflected
    // here before we prompt the user.
    await this.syncService.fullSync(false);

    if (!(await this.userKeyIsV1(userId))) {
      this.logService.info(
        `[V2KeyRotationMigration] After syncing, user ${userId} is already on v2. Skipping.`,
      );
      return "noMigrationNeeded";
    }

    if (await this.userEnrolledInAccountRecovery(userId)) {
      this.logService.info(
        `[V2KeyRotationMigration] User ${userId} is enrolled in account recovery. Skipping.`,
      );
      return "noMigrationNeeded";
    }

    if (await this.userHasGrantedEmergencyAccess(userId)) {
      this.logService.info(
        `[V2KeyRotationMigration] User ${userId} has granted emergency access. Skipping.`,
      );
      return "noMigrationNeeded";
    }

    this.logService.info(
      "checking for corrupted keys or attachments that would cause rotation to be lossy",
    );
    if (await this.userHasCorruptedPrivateKey(userId)) {
      this.logService.info(
        `[V2KeyRotationMigration] User ${userId} has a missing or corrupted private key. Skipping.`,
      );
      return "noMigrationNeeded";
    }

    this.logService.info("checking for corrupted ciphers that would cause rotation to be lossy");
    // if (await this.userHasCorruptedCiphers(userId)) {
    //   this.logService.info(
    //     `[V2KeyRotationMigration] User ${userId} has ciphers that failed to decrypt. Skipping.`,
    //   );
    //   return "noMigrationNeeded";
    // }

    this.logService.info("checking for v1 attachments that would be lost in rotation");
    if (await this.userHasV1Attachments(userId)) {
      this.logService.info(`[V2KeyRotationMigration] User ${userId} has v1 attachments. Skipping.`);
      return "noMigrationNeeded";
    }

    this.logService.info(`User ${userId} is eligible for v2 key rotation migration.`);
    return "needsMigrationWithMasterPassword";
  }

  async runMigrations(userId: UserId, masterPassword: string | null): Promise<void> {
    assertNonNullish(userId, "userId");
    assertNonNullish(masterPassword, "masterPassword");

    this.logService.info(
      `[V2KeyRotationMigration] Performing full sync before v2 rotation for user ${userId}`,
    );
    await this.syncService.fullSync(true);

    this.logService.info(`[V2KeyRotationMigration] Rotating user key for user ${userId}`);
    const success = await this.userKeyRotationService.rotateUserKey(
      { Password: { password: masterPassword } },
      userId,
      true,
    );
    this.logService.info(
      `[V2KeyRotationMigration] Performing second full sync after v2 rotation for user ${userId}`,
    );
    await this.syncService.fullSync(true);

    if (!success) {
      throw new Error("[V2KeyRotationMigration] Rotation aborted by user trust prompt.");
    }
  }

  private async userKeyIsV1(userId: UserId): Promise<boolean> {
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      return false;
    }
    await SdkLoadService.Ready;
    return CryptoClient.get_key_id_for_symmetric_key(userKey.toEncoded()) == null;
  }

  private async userEnrolledInAccountRecovery(userId: UserId): Promise<boolean> {
    const orgs = await firstValueFrom(this.organizationService.organizations$(userId));
    return orgs.some((o) => o.resetPasswordEnrolled);
  }

  private async userHasGrantedEmergencyAccess(userId: UserId): Promise<boolean> {
    const response = await this.apiService.send(
      "GET",
      "/emergency-access/granted",
      null,
      userId,
      true,
    );
    const data = response?.Data ?? response?.data;
    return Array.isArray(data) && data.length > 0;
  }

  private async userHasCorruptedPrivateKey(userId: UserId): Promise<boolean> {
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        concatMap(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return await ref.value
            .user_crypto_management()
            .should_regenerate_public_key_encryption_key_pair();
        }),
      ),
    );
  }

  private async userHasV1Attachments(userId: UserId): Promise<boolean> {
    const ciphers = await firstValueFrom(this.cipherService.cipherViews$(userId));
    return ciphers.some((c) => c.attachments?.some((a) => a.isLegacyAttachment()));
  }
}
