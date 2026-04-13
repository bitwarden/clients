import { firstValueFrom } from "rxjs";

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
      this.logService.info(
        `[BiometricPersistentMigration] Biometric unlock not enabled for user ${userId}, skipping migration check`,
      );
      return "noMigrationNeeded";
    }

    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      this.logService.info(
        `[BiometricPersistentMigration] User key not available for user ${userId}, skipping migration check`,
      );
      return "noMigrationNeeded";
    }

    const currentKeyId = CryptoClient.get_key_id_for_symmetric_key(userKey.toEncoded());
    if (currentKeyId == null) {
      this.logService.info(
        `[BiometricPersistentMigration] Unable to derive key ID from user key for user ${userId}, skipping migration check`,
      );
      return "noMigrationNeeded";
    }

    const enrolledKeyId = await this.biometricStateService.getBiometricEnrolledKeyId(userId);
    this.logService.info("enrolledKeyId", enrolledKeyId);
    this.logService.info("currentKeyId", Utils.fromBufferToB64(currentKeyId));
    if (enrolledKeyId === Utils.fromBufferToB64(currentKeyId)) {
      this.logService.info(
        `[BiometricPersistentMigration] Biometric key is up to date for user ${userId}, skipping migration`,
      );
      return "noMigrationNeeded";
    }

    return "needsMigration";
  }

  async runMigrations(userId: UserId, _masterPassword: string | null): Promise<void> {
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      throw new Error("User key is not available");
    }

    this.logService.info(
      `[BiometricPersistentMigration] Re-enrolling biometric keys for user ${userId}`,
    );

    // Re-enroll persistent biometric key if one exists
    if (await this.biometricsService.hasPersistentKey(userId)) {
      await this.biometricsService.enrollPersistent(userId, userKey);
      await this.biometricsService.setBiometricProtectedUnlockKeyForUser(userId, userKey);
    }

    const keyId = CryptoClient.get_key_id_for_symmetric_key(userKey.toEncoded());
    if (keyId != null) {
      await this.biometricStateService.setBiometricEnrolledKeyId(
        userId,
        Utils.fromBufferToB64(keyId),
      );
    } else {
      await this.biometricStateService.setBiometricEnrolledKeyId(userId, null);
    }
  }
}
