import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { toTsBiometricsStatus } from "@bitwarden/common/key-management/biometrics-status-mapper";
import { fromTsUserId } from "@bitwarden/common/key-management/utils";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsService, BiometricsStatus, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import {
  ipcRequestAuthenticateBiometrics,
  ipcRequestGetBiometricsStatus,
  ipcRequestUnlockBiometrics,
} from "@bitwarden/sdk-internal";

import { CliIpcService } from "../platform/services/cli-ipc.service";

export class CliBiometricsService extends BiometricsService {
  private readonly noInteractionTimeout = 5_000;
  private readonly interactionTimeout = 60_000;

  constructor(
    private accountService: AccountService,
    private keyService: KeyService,
    private logService: LogService,
    private ipcService: CliIpcService,
  ) {
    super();
  }

  async authenticateWithBiometrics(): Promise<boolean> {
    try {
      await this.ipcService.verifyDesktopConnection();
      return await ipcRequestAuthenticateBiometrics(
        this.ipcService.client,
        AbortSignal.timeout(this.interactionTimeout),
      );
    } catch (error) {
      this.logService.info("CLI biometric authentication failed", error);
      return false;
    }
  }

  async getBiometricsStatus(): Promise<BiometricsStatus> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    return account == null
      ? BiometricsStatus.NotEnabledLocally
      : await this.getBiometricsStatusForUser(account.id);
  }

  async unlockWithBiometricsForUser(userId: UserId): Promise<UserKey | null> {
    try {
      await this.ipcService.verifyDesktopConnection();
      const response = await ipcRequestUnlockBiometrics(
        this.ipcService.client,
        fromTsUserId(userId),
        AbortSignal.timeout(this.interactionTimeout),
      );

      if (response.user_key == null) {
        return null;
      }

      const userKey = SymmetricCryptoKey.fromSdk(response.user_key) as UserKey;
      if (!(await this.keyService.validateUserKey(userKey, userId))) {
        this.logService.info("CLI biometric unlock failed: desktop returned an invalid user key");
        return null;
      }

      return userKey;
    } catch (error) {
      this.logService.info("CLI biometric unlock failed", error);
      return null;
    }
  }

  async getBiometricsStatusForUser(userId: UserId): Promise<BiometricsStatus> {
    try {
      const desktopVersion = await this.ipcService.verifyDesktopConnection();
      this.logService.info(`[IPC] Connected to Bitwarden Desktop ${desktopVersion}`);
      const status = await ipcRequestGetBiometricsStatus(
        this.ipcService.client,
        fromTsUserId(userId),
        AbortSignal.timeout(this.noInteractionTimeout),
      );
      const mappedStatus = toTsBiometricsStatus(status);
      return mappedStatus === BiometricsStatus.NotEnabledLocally
        ? BiometricsStatus.NotEnabledInConnectedDesktopApp
        : mappedStatus;
    } catch (error) {
      this.logService.info("Could not query Bitwarden Desktop biometric status", error);
      return BiometricsStatus.DesktopDisconnected;
    }
  }

  disconnect(): void {
    this.ipcService.disconnect();
  }

  async getShouldAutopromptNow(): Promise<boolean> {
    return false;
  }

  async setShouldAutopromptNow(value: boolean): Promise<void> {}
  async canEnableBiometricUnlock(): Promise<boolean> {
    return (await this.getBiometricsStatus()) === BiometricsStatus.Available;
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
