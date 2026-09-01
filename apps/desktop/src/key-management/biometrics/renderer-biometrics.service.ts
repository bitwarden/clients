import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { toSdkBiometricsStatus } from "@bitwarden/common/key-management/biometrics-status-mapper";
import { fromSdkUserId } from "@bitwarden/common/key-management/utils";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { IpcService } from "@bitwarden/common/platform/ipc";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsStatus, BiometricStateService } from "@bitwarden/key-management";
import {
  CryptoClient,
  ipcRegisterBiometricsHandlers,
  SymmetricKey,
  UserId as SdkUserId,
  BiometricsUnlock,
  BiometricsStatus as SdkBiometricsStatus,
} from "@bitwarden/sdk-internal";
import { UnlockService } from "@bitwarden/unlock";
import { UserId } from "@bitwarden/user-core";

import { DesktopBiometricsService } from "./desktop.biometrics.service";

// Should not be enabled until after shared unlock is enabled
// This toggles whether the desktop app gets unlock whenever the browser requests an unlock. This
// should only happen after shared unlock has rolled out since otherwise the desktop app
// inadvertently gets unlocked but not locked again.
const SET_USERKEY_UNLOCK = false;

/**
 * SDK driver for biometrics IPC. This is responsible for responding to the browser extension's requests to unlock with biometrics.
 * This replaces the `BiometricMessageHandlerService` entirely.
 */
class BiometricsUnlockDriver implements BiometricsUnlock {
  constructor(
    private biometricsService: RendererBiometricsService,
    private unlockService: UnlockService,
  ) {}

  async get_biometrics_status(user_id: SdkUserId): Promise<SdkBiometricsStatus> {
    const status = await this.biometricsService.getBiometricsStatusForUser(fromSdkUserId(user_id));
    return toSdkBiometricsStatus(status);
  }

  async unlock_biometrics(user_id: SdkUserId): Promise<SymmetricKey | undefined> {
    const key = await this.biometricsService.unlockWithBiometricsForUser(fromSdkUserId(user_id));
    if (key == null) {
      return undefined;
    }

    if (SET_USERKEY_UNLOCK) {
      await this.unlockService.unlockWithDecryptedUserKey(fromSdkUserId(user_id), key);
    }
    return key.toSdk();
  }

  async authenticate_biometrics(): Promise<boolean> {
    return await this.biometricsService.authenticateWithBiometrics();
  }
}

/**
 * This service implement the base biometrics service to provide desktop specific functions,
 * specifically for the renderer process by passing messages to the main process.
 */
@Injectable()
export class RendererBiometricsService extends DesktopBiometricsService {
  constructor(
    private tokenService: TokenService,
    private biometricStateService: BiometricStateService,
    private ipcService: IpcService,
  ) {
    super();
  }

  async authenticateWithBiometrics(): Promise<boolean> {
    return await ipc.keyManagement.biometric.authenticateWithBiometrics();
  }

  async getBiometricsStatus(): Promise<BiometricsStatus> {
    return await ipc.keyManagement.biometric.getBiometricsStatus();
  }

  async unlockWithBiometricsForUser(userId: UserId): Promise<UserKey | null> {
    const userKey = await ipc.keyManagement.biometric.unlockWithBiometricsForUser(userId);
    if (userKey == null) {
      return null;
    }
    // Objects received over IPC lose their prototype, so they must be recreated to restore methods and properties.
    return SymmetricCryptoKey.fromJSON(userKey) as UserKey;
  }

  async getBiometricsStatusForUser(id: UserId): Promise<BiometricsStatus> {
    if ((await firstValueFrom(this.tokenService.hasAccessToken$(id))) === false) {
      return BiometricsStatus.NotEnabledInConnectedDesktopApp;
    }

    return await ipc.keyManagement.biometric.getBiometricsStatusForUser(id);
  }

  async setBiometricProtectedUnlockKeyForUser(
    userId: UserId,
    value: SymmetricCryptoKey,
  ): Promise<void> {
    return await ipc.keyManagement.biometric.setBiometricProtectedUnlockKeyForUser(
      userId,
      value.toBase64(),
    );
  }

  async deleteBiometricUnlockKeyForUser(userId: UserId): Promise<void> {
    return await ipc.keyManagement.biometric.deleteBiometricUnlockKeyForUser(userId);
  }

  async setupBiometrics(): Promise<void> {
    return await ipc.keyManagement.biometric.setupBiometrics();
  }

  async getShouldAutopromptNow(): Promise<boolean> {
    return await ipc.keyManagement.biometric.getShouldAutoprompt();
  }

  async setShouldAutopromptNow(value: boolean): Promise<void> {
    return await ipc.keyManagement.biometric.setShouldAutoprompt(value);
  }

  async canEnableBiometricUnlock(): Promise<boolean> {
    const biometricStatus = await this.getBiometricsStatus();
    return [
      BiometricsStatus.Available,
      BiometricsStatus.AutoSetupNeeded,
      BiometricsStatus.ManualSetupNeeded,
    ].includes(biometricStatus);
  }

  async enrollPersistent(userId: UserId, key: SymmetricCryptoKey): Promise<void> {
    await ipc.keyManagement.biometric.enrollPersistent(userId, key.toBase64());
    await SdkLoadService.Ready;
    const keyId = CryptoClient.get_key_id_for_symmetric_key(key.toEncoded());
    if (keyId != null) {
      await this.biometricStateService.setBiometricEnrolledKeyId(
        userId,
        Utils.fromBufferToB64(keyId),
      );
    } else {
      await this.biometricStateService.setBiometricEnrolledKeyId(userId, null);
    }
  }

  async hasPersistentKey(userId: UserId): Promise<boolean> {
    return await ipc.keyManagement.biometric.hasPersistentKey(userId);
  }

  async enableLinuxV2Biometrics(): Promise<void> {
    return await ipc.keyManagement.biometric.enableLinuxV2Biometrics();
  }

  async isLinuxV2BiometricsEnabled(): Promise<boolean> {
    return await ipc.keyManagement.biometric.isLinuxV2BiometricsEnabled();
  }

  async setUnlockService(service: UnlockService): Promise<void> {
    await super.setUnlockService(service);
    const driver = new BiometricsUnlockDriver(this, service);
    await ipcRegisterBiometricsHandlers(this.ipcService.client, driver);
  }
}
