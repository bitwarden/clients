import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { WindowMain } from "../../../main/window.main";
import { ElectronStateService } from "../../services/electron-state.service.abstraction";

import { BiometricsServiceAbstraction, OsBiometricService } from "./biometrics.service.abstraction";

export class BiometricsService implements BiometricsServiceAbstraction {
  private platformSpecificService: OsBiometricService;
  private clientKeyHalves = new Map<string, string>();

  constructor(
    private i18nService: I18nService,
    private windowMain: WindowMain,
    private stateService: ElectronStateService,
    private logService: LogService,
    private messagingService: MessagingService,
    private platform: NodeJS.Platform
  ) {
    this.loadPlatformSpecificService(this.platform);
  }

  private loadPlatformSpecificService(platform: NodeJS.Platform) {
    if (platform === "win32") {
      this.loadWindowsHelloService();
    } else if (platform === "darwin") {
      this.loadMacOSService();
    } else if (platform === "linux") {
      this.loadUnixService();
    }
  }

  private loadWindowsHelloService() {
    // eslint-disable-next-line
    const BiometricWindowsMain = require("./biometric.windows.main").default;
    this.platformSpecificService = new BiometricWindowsMain(
      this.i18nService,
      this.windowMain,
      this.stateService,
      this.logService
    );
  }

  private loadMacOSService() {
    // eslint-disable-next-line
    const BiometricDarwinMain = require("./biometric.darwin.main").default;
    this.platformSpecificService = new BiometricDarwinMain(this.i18nService, this.stateService);
  }

  private loadUnixService() {
    // eslint-disable-next-line
    const BiometricUnixMain = require("./biometric.unix.main").default;
    this.platformSpecificService = new BiometricUnixMain(
      this.i18nService,
      this.windowMain,
      this.stateService,
      this.logService
    );
  }

  async init() {
    return await this.platformSpecificService.init();
  }

  async osSupportsBiometric() {
    return await this.platformSpecificService.osSupportsBiometric();
  }

  async osBiometricsNeedsSetup() {
    return await this.platformSpecificService.osBiometricsNeedsSetup();
  }

  async osBiometricsSetup() {
    await this.platformSpecificService.osBiometricsSetup();
  }

  async canAuthBiometric({
    service,
    key,
    userId,
  }: {
    service: string;
    key: string;
    userId: string;
  }): Promise<boolean> {
    const requireClientKeyHalf = await this.stateService.getBiometricRequirePasswordOnStart({
      userId,
    });
    const clientKeyHalfB64 = this.getClientKeyHalf(service, key);
    const clientKeyHalfSatisfied = !requireClientKeyHalf || !!clientKeyHalfB64;
    return clientKeyHalfSatisfied && (await this.osSupportsBiometric());
  }

  async authenticateBiometric(): Promise<boolean> {
    let result = false;
    this.interruptProcessReload(
      () => {
        return this.platformSpecificService.authenticateBiometric();
      },
      (response) => {
        result = response;
        return !response;
      }
    );
    return result;
  }

  async getBiometricKey(service: string, storageKey: string): Promise<string | null> {
    return await this.interruptProcessReload(async () => {
      await this.enforceClientKeyHalf(service, storageKey);

      return await this.platformSpecificService.getBiometricKey(
        service,
        storageKey,
        this.getClientKeyHalf(service, storageKey)
      );
    });
  }

  async setBiometricKey(service: string, storageKey: string, value: string): Promise<void> {
    await this.enforceClientKeyHalf(service, storageKey);

    return await this.platformSpecificService.setBiometricKey(
      service,
      storageKey,
      value,
      this.getClientKeyHalf(service, storageKey)
    );
  }

  /** Registers the client-side encryption key half for the OS stored Biometric key. The other half is protected by the OS.*/
  async setEncryptionKeyHalf({
    service,
    key,
    value,
  }: {
    service: string;
    key: string;
    value: string;
  }): Promise<void> {
    if (value == null) {
      this.clientKeyHalves.delete(this.clientKeyHalfKey(service, key));
    } else {
      this.clientKeyHalves.set(this.clientKeyHalfKey(service, key), value);
    }
  }

  async deleteBiometricKey(service: string, storageKey: string): Promise<void> {
    this.clientKeyHalves.delete(this.clientKeyHalfKey(service, storageKey));
    return await this.platformSpecificService.deleteBiometricKey(service, storageKey);
  }

  private async interruptProcessReload<T>(
    callback: () => Promise<T>,
    restartReloadCallback: (arg: T) => boolean = () => false
  ): Promise<T> {
    this.messagingService.send("cancelProcessReload");
    let restartReload = false;
    let response: T;
    try {
      response = await callback();
      restartReload ||= restartReloadCallback(response);
    } catch {
      restartReload = true;
    }

    if (restartReload) {
      this.messagingService.send("startProcessReload");
    }

    return response;
  }

  private clientKeyHalfKey(service: string, key: string): string {
    return `${service}:${key}`;
  }

  private getClientKeyHalf(service: string, key: string): string | undefined {
    return this.clientKeyHalves.get(this.clientKeyHalfKey(service, key)) ?? undefined;
  }

  private async enforceClientKeyHalf(service: string, storageKey: string): Promise<void> {
    const requireClientKeyHalf = await this.stateService.getBiometricRequirePasswordOnStart();
    const clientKeyHalfB64 = this.getClientKeyHalf(service, storageKey);

    if (requireClientKeyHalf && !clientKeyHalfB64) {
      throw new Error("Biometric key requirements not met. No client key half provided.");
    }
  }
}
