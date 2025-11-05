import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { BiometricsStatus, BiometricStateService } from "@bitwarden/key-management";

import { WindowMain } from "../../main/window.main";

import { DesktopBiometricsService } from "./desktop.biometrics.service";
import { LinuxBiometricsSystem, WindowsBiometricsSystem } from "./native-v2";
import { OsBiometricService } from "./os-biometrics.service";

export class MainBiometricsService extends DesktopBiometricsService {
  private osBiometricsService: OsBiometricService;
  private shouldAutoPrompt = true;
  private windowsV2BiometricsEnabled = false;
  private linuxV2BiometricsEnabled = false;

  constructor(
    private i18nService: I18nService,
    private windowMain: WindowMain,
    private logService: LogService,
    private platform: NodeJS.Platform,
    private biometricStateService: BiometricStateService,
    private encryptService: EncryptService,
    private cryptoFunctionService: CryptoFunctionService,
  ) {
    super();
    if (platform === "win32") {
      // eslint-disable-next-line
      const OsBiometricsServiceWindows = require("./os-biometrics-windows.service").default;
      this.osBiometricsService = new OsBiometricsServiceWindows(
        this.i18nService,
        this.windowMain,
        this.logService,
        this.biometricStateService,
        this.encryptService,
        this.cryptoFunctionService,
      );
    } else if (platform === "darwin") {
      // eslint-disable-next-line
      const OsBiometricsServiceMac = require("./os-biometrics-mac.service").default;
      this.osBiometricsService = new OsBiometricsServiceMac(this.i18nService, this.logService);
    } else if (platform === "linux") {
      // eslint-disable-next-line
      const OsBiometricsServiceLinux = require("./os-biometrics-linux.service").default;
      this.osBiometricsService = new OsBiometricsServiceLinux(
        this.biometricStateService,
        this.encryptService,
        this.cryptoFunctionService,
        this.logService,
      );
    } else {
      throw new Error("Unsupported platform");
    }
  }

  /**
   * Get the status of biometrics for the platform. Biometrics status for the platform can be one of:
   * - Available: Biometrics are available and can be used (On windows hello, (touch id (for now)) and polkit, this MAY fall back to password)
   * - HardwareUnavailable: Biometrics are not available on the platform
   * - ManualSetupNeeded: In order to use biometrics, the user must perform manual steps (linux only)
   * - AutoSetupNeeded: In order to use biometrics, the user must perform automatic steps (linux only)
   * @returns the status of the biometrics of the platform
   */
  async getBiometricsStatus(): Promise<BiometricsStatus> {
    if (!(await this.osBiometricsService.supportsBiometrics())) {
      return BiometricsStatus.HardwareUnavailable;
    } else {
      if (await this.osBiometricsService.needsSetup()) {
        if (await this.osBiometricsService.canAutoSetup()) {
          return BiometricsStatus.AutoSetupNeeded;
        } else {
          return BiometricsStatus.ManualSetupNeeded;
        }
      }
    }
    return BiometricsStatus.Available;
  }

  /**
   * Get the status of biometric unlock for a specific user. For this, biometric unlock needs to be set up for the user in the settings.
   * Next, biometrics unlock needs to be available on the platform level. If "masterpassword reprompt" is enabled, a client key half (set on first unlock) for this user
   * needs to be held in memory.
   * @param userId the user to check the biometric unlock status for
   * @returns the status of the biometric unlock for the user
   */
  async getBiometricsStatusForUser(userId: UserId): Promise<BiometricsStatus> {
    if (!(await this.biometricStateService.getBiometricUnlockEnabled(userId))) {
      return BiometricsStatus.NotEnabledLocally;
    }
    const platformStatus = await this.getBiometricsStatus();
    if (!(platformStatus === BiometricsStatus.Available)) {
      return platformStatus;
    }

    return await this.osBiometricsService.getBiometricsFirstUnlockStatusForUser(userId);
  }

  async authenticateBiometric(): Promise<boolean> {
    return await this.osBiometricsService.authenticateBiometric();
  }

  async setupBiometrics(): Promise<void> {
    return await this.osBiometricsService.runSetup();
  }

  async authenticateWithBiometrics(): Promise<boolean> {
    return await this.osBiometricsService.authenticateBiometric();
  }

  async unlockWithBiometricsForUser(userId: UserId): Promise<UserKey | null> {
    return (await this.osBiometricsService.getBiometricKey(userId)) as UserKey;
  }

  async setBiometricProtectedUnlockKeyForUser(
    userId: UserId,
    key: SymmetricCryptoKey,
  ): Promise<void> {
    return await this.osBiometricsService.setBiometricKey(userId, key);
  }

  async deleteBiometricUnlockKeyForUser(userId: UserId): Promise<void> {
    return await this.osBiometricsService.deleteBiometricKey(userId);
  }

  /**
   * Set whether to auto-prompt the user for biometric unlock; this can be used to prevent auto-prompting being initiated by a process reload.
   * Reasons for enabling auto-prompt include: Starting the app, un-minimizing the app, manually account switching
   * @param value Whether to auto-prompt the user for biometric unlock
   */
  async setShouldAutopromptNow(value: boolean): Promise<void> {
    this.shouldAutoPrompt = value;
  }

  /**
   * Get whether to auto-prompt the user for biometric unlock; If the user is auto-prompted, setShouldAutopromptNow should be immediately called with false in order to prevent another auto-prompt.
   * @returns Whether to auto-prompt the user for biometric unlock
   */
  async getShouldAutopromptNow(): Promise<boolean> {
    return this.shouldAutoPrompt;
  }

  async canEnableBiometricUnlock(): Promise<boolean> {
    return true;
  }

  async enrollPersistent(userId: UserId, key: SymmetricCryptoKey): Promise<void> {
    return await this.osBiometricsService.enrollPersistent(userId, key);
  }

  async hasPersistentKey(userId: UserId): Promise<boolean> {
    return await this.osBiometricsService.hasPersistentKey(userId);
  }

  async enableWindowsV2Biometrics(): Promise<void> {
    if (this.platform === "win32" && !this.windowsV2BiometricsEnabled) {
      this.logService.info("[BiometricsMain] Loading native biometrics module v2 for windows");
      this.osBiometricsService = new WindowsBiometricsSystem(
        this.i18nService,
        this.windowMain,
        this.logService,
      );
      this.windowsV2BiometricsEnabled = true;
    }
  }

  async isWindowsV2BiometricsEnabled(): Promise<boolean> {
    return this.windowsV2BiometricsEnabled;
  }

  async enableLinuxV2Biometrics(): Promise<void> {
    if (this.platform === "linux" && !this.linuxV2BiometricsEnabled) {
      this.logService.info("[BiometricsMain] Loading native biometrics module v2 for linux");
      this.osBiometricsService = new LinuxBiometricsSystem();
      this.linuxV2BiometricsEnabled = true;
    }
  }

  async isLinuxV2BiometricsEnabled(): Promise<boolean> {
    return this.linuxV2BiometricsEnabled;
  }
}
