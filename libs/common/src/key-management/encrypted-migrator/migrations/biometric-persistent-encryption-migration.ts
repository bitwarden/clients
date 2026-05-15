import { firstValueFrom } from "rxjs";

import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
// eslint-disable-next-line no-restricted-imports
import { BiometricStateService, BiometricsService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { CryptoClient } from "@bitwarden/sdk-internal";

import { Utils } from "../../../platform/misc/utils";
import { UserId } from "../../../types/guid";

import { EncryptedMigration, MigrationRequirement } from "./encrypted-migration";

/**
 * This migration re-enrolls biometric stored keys when the user key has changed
 * since the last biometric enrollment. It detects this by comparing the stored
 * enrolled key ID with the current user key's key ID.
 */
export class BiometricPersistentMigration implements EncryptedMigration {
  constructor(
    private readonly keyService: KeyService,
    private readonly biometricsService: BiometricsService,
    private readonly biometricStateService: BiometricStateService,
    private readonly logService: LogService,
  ) {}

  async needsMigration(userId: UserId): Promise<MigrationRequirement> {
    if (!(await firstValueFrom(this.biometricStateService.biometricUnlockEnabled$(userId)))) {
      return "noMigrationNeeded";
    }

    if (!(await this.biometricsService.hasPersistentKey(userId))) {
      return "noMigrationNeeded";
    }

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      return "noMigrationNeeded";
    }

    await SdkLoadService.Ready;
    const currentKeyId = CryptoClient.get_key_id_for_symmetric_key(userKey.toEncoded());
    const enrolledKeyId = await this.biometricStateService.getBiometricEnrolledKeyId(userId);
    const isV1ToV2Migration = enrolledKeyId == null && currentKeyId != null;
    const isV2ToV2Migration =
      enrolledKeyId != null &&
      currentKeyId != null &&
      enrolledKeyId !== Utils.fromBufferToB64(currentKeyId);
    if (isV1ToV2Migration || isV2ToV2Migration) {
      return "needsMigration";
    }

    return "noMigrationNeeded";
  }

  async runMigrations(userId: UserId, _masterPassword: string | null): Promise<void> {
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      throw new Error("User key is not available");
    }

    this.logService.info(
      `[BiometricPersistentMigration] Re-enrolling biometric keys for user ${userId}`,
    );

    await this.biometricsService.enrollPersistent(userId, userKey);
    await this.biometricsService.setBiometricProtectedUnlockKeyForUser(userId, userKey);
  }
}
