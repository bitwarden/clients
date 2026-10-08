import { firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { BiometricStateService, BiometricsService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { CryptoClient } from "@bitwarden/sdk-internal";

import { I18nService } from "../../../platform/abstractions/i18n.service";
import { PlatformUtilsService } from "../../../platform/abstractions/platform-utils.service";
import { SdkLoadService } from "../../../platform/abstractions/sdk/sdk-load.service";
import { Utils } from "../../../platform/misc/utils";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";

import { EncryptedMigration, MigrationRequirement } from "./encrypted-migration";

/**
 * This migration re-enrolls biometric stored keys when the user key has changed
 * since the last biometric enrollment. It detects this by comparing the stored
 * enrolled key ID with the current user key's key ID; any mismatch - including a
 * key ID appearing or disappearing - triggers a re-enrollment.
 */
export class BiometricPersistentMigration implements EncryptedMigration {
  constructor(
    private readonly keyService: KeyService,
    private readonly biometricsService: BiometricsService,
    private readonly biometricStateService: BiometricStateService,
    private readonly logService: LogService,
    private readonly platformUtilsService: PlatformUtilsService,
    private readonly i18nService: I18nService,
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
    const keyId = CryptoClient.get_key_id_for_symmetric_key(userKey.toEncoded());
    const currentKeyId = Utils.fromArrayToHex(keyId);
    const enrolledKeyId = await this.biometricStateService.getBiometricEnrolledKeyId(userId);

    return currentKeyId === enrolledKeyId ? "noMigrationNeeded" : "needsMigration";
  }

  async runMigrations(userId: UserId, _masterPassword: string | null): Promise<void> {
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      throw new Error("User key is not available");
    }

    this.logService.info(
      `[BiometricPersistentMigration] Re-enrolling biometric keys for user ${userId}`,
    );

    try {
      await this.biometricsService.enrollPersistent(userId, userKey);
    } catch (e) {
      this.logService.error("[BiometricPersistentMigration] Re-enrollment failed", e);
      await this.disablePersistent(userId, userKey);
      return;
    }

    await this.biometricsService.setBiometricProtectedUnlockKeyForUser(userId, userKey);
  }

  /**
   * Turns off biometric unlock on app restart after a failed re-enrollment (e.g. cancelled Windows
   * Hello prompt). The stale persistent key cannot unlock the vault anymore, and retrying would
   * prompt on every migration run. Session biometric unlock keeps working.
   */
  private async disablePersistent(userId: UserId, userKey: UserKey): Promise<void> {
    await this.biometricsService.deleteBiometricUnlockKeyForUser(userId);
    await this.biometricsService.setBiometricProtectedUnlockKeyForUser(userId, userKey);

    this.platformUtilsService.showToast(
      "warning",
      null,
      this.i18nService.t("biometricUnlockOnRestartTurnedOff"),
    );
  }
}
