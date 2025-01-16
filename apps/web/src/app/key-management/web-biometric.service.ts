import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsService, BiometricsStatus } from "@bitwarden/key-management";

export class WebBiometricsService extends BiometricsService {
  async authenticateWithBiometrics(): Promise<boolean> {
    return false;
  }

  async getBiometricsStatus(): Promise<BiometricsStatus> {
    return BiometricsStatus.PlatformUnsupported;
  }

  async unlockWithBiometricsForUser(userId: UserId): Promise<UserKey | null> {
    return null;
  }

  async getBiometricsStatusForUser(userId: UserId): Promise<BiometricsStatus> {
    return BiometricsStatus.PlatformUnsupported;
  }

  async getShouldAutopromptNow(): Promise<boolean> {
    return false;
  }

  async setShouldAutopromptNow(value: boolean): Promise<void> {}
}
