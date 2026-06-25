import { firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { UserKeyRotationServiceAbstraction } from "@bitwarden/user-crypto-management";

import { assertNonNullish } from "../../../auth/utils";
import { FeatureFlag } from "../../../enums/feature-flag.enum";
import { ConfigService } from "../../../platform/abstractions/config/config.service";
import { SdkService } from "../../../platform/abstractions/sdk/sdk.service";
import { EncryptionType } from "../../../platform/enums";
import { SyncService } from "../../../platform/sync";
import { UserId } from "../../../types/guid";
import { CipherService } from "../../../vault/abstractions/cipher.service";
import { CipherView } from "../../../vault/models/view/cipher.view";
import { MasterPasswordServiceAbstraction } from "../../master-password/abstractions/master-password.service.abstraction";
import { withPasswordManagerSdk } from "../../utils";

import { EncryptedMigration, MigrationRequirement } from "./encrypted-migration";

/**
 * Migrates users that are on v1 encryption to v2 encryption by performing
 * a key rotation.
 */
export class V2KeyRotationMigration implements EncryptedMigration {
  constructor(
    private readonly keyService: KeyService,
    private readonly userKeyRotationService: UserKeyRotationServiceAbstraction,
    private readonly masterPasswordService: MasterPasswordServiceAbstraction,
    private readonly syncService: SyncService,
    private readonly configService: ConfigService,
    private readonly logService: LogService,
    private readonly cipherService: CipherService,
    private readonly sdkService: SdkService,
  ) {}

  async needsMigration(userId: UserId): Promise<MigrationRequirement> {
    assertNonNullish(userId, "userId");
    if (!(await this.configService.getFeatureFlag(FeatureFlag.ForceUpgradeV2Encryption))) {
      return "noMigrationNeeded";
    }

    if (!(await this.userKeyIsV1(userId))) {
      return "noMigrationNeeded";
    }

    // Sync first so a rotation already performed on another client is reflected
    // here before we prompt the user.
    await this.syncService.fullSync(false);

    if (await this.userHasV1Attachments(userId)) {
      this.logService.info(`[V2KeyRotationMigration] User ${userId} has v1 attachments. Skipping.`);
      return "noMigrationNeeded";
    }

    if (await this.userHasCorruptedPrivateKey(userId)) {
      this.logService.info(
        `[V2KeyRotationMigration] User ${userId} has a missing or corrupted private key. Skipping.`,
      );
      return "noMigrationNeeded";
    }

    if (await this.userHasCorruptCiphers(userId)) {
      this.logService.info(
        `[V2KeyRotationMigration] User ${userId} has corrupt ciphers that cannot be decrypted. Skipping.`,
      );
      return "noMigrationNeeded";
    }

    if (!(await this.userKeyIsV1(userId))) {
      this.logService.info(
        `[V2KeyRotationMigration] After syncing, user ${userId} is already on v2. Skipping.`,
      );
      return "noMigrationNeeded";
    }

    // -- Temporary blocks that will be resolved before release:
    if (!(await this.masterPasswordService.userHasMasterPassword(userId))) {
      // KC / TDE not supported in initial PR
      return "noMigrationNeeded";
    }

    // Currently not supported for users that have account recovery enabled
    if (await this.userEnrolledInAccountRecovery(userId)) {
      this.logService.info(
        `[V2KeyRotationMigration] User ${userId} is enrolled in account recovery. Skipping.`,
      );
      return "noMigrationNeeded";
    }

    // Currently not supported for users that have emergency access enabled
    if (await this.userHasGrantedEmergencyAccess(userId)) {
      this.logService.info(
        `[V2KeyRotationMigration] User ${userId} has granted emergency access. Skipping.`,
      );
      return "noMigrationNeeded";
    }

    return "needsMigrationWithMasterPassword";
  }

  async runMigrations(userId: UserId, masterPassword: string | null): Promise<void> {
    assertNonNullish(userId, "userId");

    this.logService.info(`[V2KeyRotationMigration] Rotating user key for user ${userId}`);

    if (await this.masterPasswordService.userHasMasterPassword(userId)) {
      assertNonNullish(masterPassword, "masterPassword");
      const success = await this.userKeyRotationService.rotateUserKey(
        { Password: { password: masterPassword! } },
        "CreateIfNeeded",
        userId,
      );
      if (!success) {
        throw new Error("[V2KeyRotationMigration] Rotation aborted by user trust prompt.");
      }
    } else {
      throw new Error(
        "[V2KeyRotationMigration] Rotation for users without master passwords is not currently supported.",
      );
    }

    this.logService.info(
      `[V2KeyRotationMigration] Performing full sync after v2 upgrade for user ${userId}`,
    );
    await this.syncService.fullSync(true);
  }

  private async userKeyIsV1(userId: UserId): Promise<boolean> {
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      throw new Error(`[V2KeyRotationMigration] No user key found for user ${userId}`);
    }
    return userKey.inner().type === EncryptionType.AesCbc256_HmacSha256_B64;
  }

  private async userEnrolledInAccountRecovery(userId: UserId): Promise<boolean> {
    return await withPasswordManagerSdk(userId, this.sdkService, async (sdk) => {
      const organizationV1Memberships = await sdk
        .user_crypto_management()
        .get_untrusted_organization_public_keys();
      return organizationV1Memberships.length > 0;
    });
  }

  private async userHasGrantedEmergencyAccess(userId: UserId): Promise<boolean> {
    return await withPasswordManagerSdk(userId, this.sdkService, async (sdk) => {
      const emergencyAccessV1Memberships = await sdk
        .user_crypto_management()
        .get_untrusted_emergency_access_public_keys();
      return emergencyAccessV1Memberships.length > 0;
    });
  }

  private async userHasCorruptedPrivateKey(userId: UserId): Promise<boolean> {
    return await withPasswordManagerSdk(userId, this.sdkService, async (sdk) => {
      return await sdk.user_crypto_management().should_regenerate_public_key_encryption_key_pair();
    });
  }

  private async userHasV1Attachments(userId: UserId): Promise<boolean> {
    const ciphers = await firstValueFrom(this.cipherService.cipherViews$(userId));
    return (
      ciphers != null &&
      ciphers
        .filter((c: CipherView) => c.isUserOwnedCipher)
        .some((c: CipherView) => c.hasOldAttachments)
    );
  }

  private async userHasCorruptCiphers(userId: UserId): Promise<boolean> {
    // Force the decryption of ciphers in case they are not decrypted otherwise, and discard the result.
    // Otherwise, the failedToDecryptCiphers may block forever.
    await firstValueFrom(this.cipherService.cipherViews$(userId));
    const ciphers = await firstValueFrom(this.cipherService.failedToDecryptCiphers$(userId));
    return ciphers != null && ciphers.length > 0;
  }
}
