import { Injectable } from "@angular/core";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsService, BiometricsCommands, BiometricsStatus } from "@bitwarden/key-management";

import { NativeMessagingBackground } from "../../background/nativeMessaging.background";

@Injectable()
export class BackgroundBrowserBiometricsService extends BiometricsService {
  constructor(
    private nativeMessagingBackground: () => NativeMessagingBackground,
    private logService: LogService,
  ) {
    super();
  }

  async authenticateWithBiometrics(): Promise<boolean> {
    try {
      await this.ensureConnected();

      if (this.nativeMessagingBackground().isConnectedToOutdatedDesktopClient) {
        const response = await this.nativeMessagingBackground().callCommand({
          command: BiometricsCommands.Unlock,
        });
        return response.response == "unlocked";
      } else {
        const response = await this.nativeMessagingBackground().callCommand({
          command: BiometricsCommands.AuthenticateWithBiometrics,
        });
        return response.response;
      }
    } catch (e) {
      this.logService.info("Biometric authentication failed", e);
      return false;
    }
  }

  async getBiometricsStatus(): Promise<BiometricsStatus> {
    try {
      await this.ensureConnected();

      if (this.nativeMessagingBackground().isConnectedToOutdatedDesktopClient) {
        const response = await this.nativeMessagingBackground().callCommand({
          command: BiometricsCommands.IsAvailable,
        });
        const resp =
          response.response == "available"
            ? BiometricsStatus.Available
            : BiometricsStatus.HardwareUnavailable;
        return resp;
      } else {
        const response = await this.nativeMessagingBackground().callCommand({
          command: BiometricsCommands.GetBiometricsStatus,
        });

        if (response.response) {
          return response.response;
        }
      }
      return BiometricsStatus.Available;
    } catch (e) {
      return BiometricsStatus.DesktopDisconnected;
    }
  }

  async unlockWithBiometricsForUser(userId: UserId): Promise<UserKey | null> {
    try {
      await this.ensureConnected();

      if (this.nativeMessagingBackground().isConnectedToOutdatedDesktopClient) {
        const response = await this.nativeMessagingBackground().callCommand({
          command: BiometricsCommands.Unlock,
        });
        if (response.response == "unlocked") {
          return response.userKeyB64;
        } else {
          return null;
        }
      } else {
        const response = await this.nativeMessagingBackground().callCommand({
          command: BiometricsCommands.UnlockWithBiometricsForUser,
          userId: userId,
        });
        if (response.response) {
          return response.userKeyB64;
        } else {
          return null;
        }
      }
    } catch (e) {
      this.logService.info("Biometric unlock for user failed", e);
      throw new Error("Biometric unlock failed");
    }
  }

  async getBiometricsStatusForUser(id: UserId): Promise<BiometricsStatus> {
    try {
      await this.ensureConnected();

      if (this.nativeMessagingBackground().isConnectedToOutdatedDesktopClient) {
        return await this.getBiometricsStatus();
      }

      return (
        await this.nativeMessagingBackground().callCommand({
          command: BiometricsCommands.GetBiometricsStatusForUser,
          userId: id,
        })
      ).response;
    } catch (e) {
      return BiometricsStatus.DesktopDisconnected;
    }
  }

  // the first time we call, this might use an outdated version of the protocol, so we drop the response
  private async ensureConnected() {
    if (!this.nativeMessagingBackground().connected) {
      await this.nativeMessagingBackground().callCommand({
        command: BiometricsCommands.IsAvailable,
      });
    }
  }

  async getShouldAutopromptNow(): Promise<boolean> {
    return false;
  }

  async setShouldAutopromptNow(value: boolean): Promise<void> {}
}
