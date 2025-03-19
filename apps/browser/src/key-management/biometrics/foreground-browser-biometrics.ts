import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsCommands, BiometricsService, BiometricsStatus } from "@bitwarden/key-management";

import { BrowserApi } from "../../platform/browser/browser-api";

export class ForegroundBrowserBiometricsService extends BiometricsService {
  shouldAutopromptNow = true;

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
    return response.result;
  }

  async getShouldAutopromptNow(): Promise<boolean> {
    return this.shouldAutopromptNow;
  }
  async setShouldAutopromptNow(value: boolean): Promise<void> {
    this.shouldAutopromptNow = value;
  }
}
