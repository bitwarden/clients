import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsService, BiometricsStatus, KeyService } from "@bitwarden/key-management";

import { NativeMessagingClient } from "./biometrics/native-messaging-client";

/**
 * CLI Biometrics Service
 *
 * Provides biometric unlock functionality for the CLI by communicating with
 * the Bitwarden Desktop app via IPC (same protocol as browser extension).
 *
 * Requirements:
 * - Bitwarden Desktop app must be running
 * - Biometric unlock must be enabled in the Desktop app
 * - User must be logged into the same account in both CLI and Desktop
 */
export class CliBiometricsService extends BiometricsService {
  private nativeMessagingClient: NativeMessagingClient | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
    private cryptoFunctionService: CryptoFunctionService,
    private appIdService: AppIdService,
    private logService: LogService,
    private accountService: AccountService,
  ) {
    super();
  }

  /**
   * Initialize the native messaging client lazily.
   */
  private async ensureClient(): Promise<NativeMessagingClient> {
    if (this.nativeMessagingClient == null) {
      this.nativeMessagingClient = new NativeMessagingClient(
        this.keyService,
        this.encryptService,
        this.cryptoFunctionService,
        this.appIdService,
        this.logService,
        this.accountService,
      );
    }

    // Only initialize/connect once
    if (this.initPromise == null) {
      this.initPromise = this.initializeConnection();
    }

    await this.initPromise;
    return this.nativeMessagingClient;
  }

  /**
   * Initialize the connection to the desktop app.
   */
  private async initializeConnection(): Promise<void> {
    if (this.nativeMessagingClient == null) {
      return;
    }

    try {
      const isAvailable = await this.nativeMessagingClient.isDesktopAppAvailable();
      if (!isAvailable) {
        this.logService.debug("[CLI Biometrics] Desktop app socket not found");
        return;
      }

      await this.nativeMessagingClient.connect();
    } catch (e) {
      this.logService.debug("[CLI Biometrics] Failed to connect to desktop app:", e);
      // Reset for retry
      this.initPromise = null;
    }
  }

  /**
   * Perform biometric authentication (without returning keys).
   */
  async authenticateWithBiometrics(): Promise<boolean> {
    try {
      const client = await this.ensureClient();
      return await client.authenticateWithBiometrics();
    } catch (e) {
      this.logService.info("[CLI Biometrics] Biometric authentication failed:", e);
      return false;
    }
  }

  /**
   * Get the overall biometrics status.
   */
  async getBiometricsStatus(): Promise<BiometricsStatus> {
    try {
      // First check if desktop app is available
      if (this.nativeMessagingClient == null) {
        this.nativeMessagingClient = new NativeMessagingClient(
          this.keyService,
          this.encryptService,
          this.cryptoFunctionService,
          this.appIdService,
          this.logService,
          this.accountService,
        );
      }

      const isAvailable = await this.nativeMessagingClient.isDesktopAppAvailable();
      if (!isAvailable) {
        return BiometricsStatus.DesktopDisconnected;
      }

      const client = await this.ensureClient();
      const status = await client.getBiometricsStatus();

      if (typeof status === "number") {
        return status as BiometricsStatus;
      }

      return BiometricsStatus.Available;
    } catch (e) {
      this.logService.debug("[CLI Biometrics] Failed to get biometrics status:", e);
      return BiometricsStatus.DesktopDisconnected;
    }
  }

  /**
   * Unlock with biometrics for a specific user.
   * Returns the UserKey if successful.
   */
  async unlockWithBiometricsForUser(userId: UserId): Promise<UserKey | null> {
    try {
      const client = await this.ensureClient();
      const userKeyB64 = await client.unlockWithBiometricsForUser(userId);

      if (userKeyB64 == null) {
        return null;
      }

      const decodedUserKey = Utils.fromB64ToArray(userKeyB64);
      const userKey = new SymmetricCryptoKey(decodedUserKey) as UserKey;

      // Validate the key before returning
      if (await this.keyService.validateUserKey(userKey, userId)) {
        return userKey;
      }

      this.logService.warning("[CLI Biometrics] User key validation failed");
      return null;
    } catch (e) {
      this.logService.info("[CLI Biometrics] Biometric unlock failed:", e);
      throw new Error("Biometric unlock failed");
    }
  }

  /**
   * Get biometrics status for a specific user.
   */
  async getBiometricsStatusForUser(userId: UserId): Promise<BiometricsStatus> {
    try {
      // First check if desktop app is available
      if (this.nativeMessagingClient == null) {
        this.nativeMessagingClient = new NativeMessagingClient(
          this.keyService,
          this.encryptService,
          this.cryptoFunctionService,
          this.appIdService,
          this.logService,
          this.accountService,
        );
      }

      const isAvailable = await this.nativeMessagingClient.isDesktopAppAvailable();
      if (!isAvailable) {
        return BiometricsStatus.DesktopDisconnected;
      }

      const client = await this.ensureClient();
      const status = await client.getBiometricsStatusForUser(userId);

      if (typeof status === "number") {
        return status as BiometricsStatus;
      }

      return BiometricsStatus.Available;
    } catch (e) {
      this.logService.debug("[CLI Biometrics] Failed to get biometrics status for user:", e);
      return BiometricsStatus.DesktopDisconnected;
    }
  }

  /**
   * Whether to auto-prompt for biometrics. Always false for CLI.
   */
  async getShouldAutopromptNow(): Promise<boolean> {
    return false;
  }

  /**
   * Set whether to auto-prompt for biometrics. No-op for CLI.
   */
  async setShouldAutopromptNow(_value: boolean): Promise<void> {
    // No-op for CLI
  }

  /**
   * Check if biometric unlock can be enabled.
   */
  async canEnableBiometricUnlock(): Promise<boolean> {
    const status = await this.getBiometricsStatus();
    return (
      status !== BiometricsStatus.DesktopDisconnected &&
      status !== BiometricsStatus.HardwareUnavailable &&
      status !== BiometricsStatus.PlatformUnsupported
    );
  }

  /**
   * Check if biometric unlock is currently available for the active user.
   */
  async isBiometricUnlockAvailable(): Promise<boolean> {
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (activeAccount == null) {
      return false;
    }

    const status = await this.getBiometricsStatusForUser(activeAccount.id);
    return status === BiometricsStatus.Available;
  }

  /**
   * Get a human-readable description of the current biometrics status.
   */
  async getBiometricsStatusDescription(): Promise<string> {
    const status = await this.getBiometricsStatus();

    switch (status) {
      case BiometricsStatus.Available:
        return "Biometric unlock is available via Desktop app";
      case BiometricsStatus.DesktopDisconnected:
        return "Desktop app is not running or not reachable";
      case BiometricsStatus.HardwareUnavailable:
        return "Biometric hardware is not available";
      case BiometricsStatus.UnlockNeeded:
        return "Vault must be unlocked with master password first in Desktop app";
      case BiometricsStatus.NotEnabledLocally:
      case BiometricsStatus.NotEnabledInConnectedDesktopApp:
        return "Biometric unlock is not enabled in Desktop app";
      case BiometricsStatus.PlatformUnsupported:
        return "Platform does not support biometric unlock";
      case BiometricsStatus.AutoSetupNeeded:
      case BiometricsStatus.ManualSetupNeeded:
        return "Biometric setup required in Desktop app";
      default:
        return `Unknown biometrics status: ${status}`;
    }
  }

  /**
   * Disconnect from the desktop app.
   */
  disconnect(): void {
    if (this.nativeMessagingClient != null) {
      this.nativeMessagingClient.disconnect();
      this.nativeMessagingClient = null;
      this.initPromise = null;
    }
  }
}
