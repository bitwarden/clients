import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsCommands, BiometricsService, BiometricsStatus } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

import { BrowserApi } from "../../platform/browser/browser-api";

export class ForegroundBrowserBiometricsService extends BiometricsService {
  shouldAutopromptNow = true;

  constructor(private platformUtilsService: PlatformUtilsService) {
    super();
  }

  async authenticateWithBiometrics(): Promise<boolean> {
    const response = await BrowserApi.sendMessageWithResponse<{
      result: boolean;
      error: string;
    }>(BiometricsCommands.AuthenticateWithBiometrics);
    if (!response.result) {
      throw response.error;
    }
    return response.result;
  }

  async getBiometricsStatus(): Promise<BiometricsStatus> {
    const response = await BrowserApi.sendMessageWithResponse<{
      result: BiometricsStatus;
      error: string;
    }>(BiometricsCommands.GetBiometricsStatus);
    return response.result;
  }

  async unlockWithBiometricsForUser(userId: UserId): Promise<UserKey | null> {
    const response = await BrowserApi.sendMessageWithResponse<{
      result: UserKey;
      error: string;
    }>(BiometricsCommands.UnlockWithBiometricsForUser, { userId });
    if (!response.result) {
      return null;
    }
    return SymmetricCryptoKey.fromString(response.result.keyB64) as UserKey;
  }

  async getBiometricsStatusForUser(id: UserId): Promise<BiometricsStatus> {
    const response = await BrowserApi.sendMessageWithResponse<{
      result: BiometricsStatus;
      error: string;
    }>(BiometricsCommands.GetBiometricsStatusForUser, { userId: id });
    if (response != null) {
      return response.result;
    } else {
      return BiometricsStatus.DesktopDisconnected;
    }
  }

  async getShouldAutopromptNow(): Promise<boolean> {
    return this.shouldAutopromptNow;
  }
  async setShouldAutopromptNow(value: boolean): Promise<void> {
    this.shouldAutopromptNow = value;
  }

  async canEnableBiometricUnlock(): Promise<boolean> {
    const needsPermissionPrompt =
      !(await BrowserApi.permissionsGranted(["nativeMessaging"])) &&
      !this.platformUtilsService.isSafari();
    return (
      needsPermissionPrompt ||
      (
        await BrowserApi.sendMessageWithResponse<{
          result: boolean;
          error: string;
        }>(BiometricsCommands.CanEnableBiometricUnlock)
      ).result
    );
  }
  async setBiometricProtectedUnlockKeyForUser(
    userId: UserId,
    value: SymmetricCryptoKey,
  ): Promise<void> {}

  async enrollPersistent(userId: UserId, key: SymmetricCryptoKey): Promise<void> {}
  async hasPersistentKey(userId: UserId): Promise<boolean> {
    return false;
  }
  async deleteBiometricUnlockKeyForUser(userId: UserId): Promise<void> {}
}
