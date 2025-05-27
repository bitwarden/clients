import { systemPreferences } from "electron";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { passwords } from "@bitwarden/desktop-napi";

import { OsBiometricService } from "./os-biometrics.service";

export default class OsBiometricsServiceMac implements OsBiometricService {
  constructor(
    private i18nservice: I18nService,
    private logService: LogService,
  ) {}

  async osSupportsBiometric(): Promise<boolean> {
    return systemPreferences.canPromptTouchID();
  }

  async authenticateBiometric(): Promise<boolean> {
    try {
      await systemPreferences.promptTouchID(this.i18nservice.t("touchIdConsentMessage"));
      return true;
    } catch {
      return false;
    }
  }

  async getBiometricKey(service: string, key: string): Promise<string | null> {
    const success = await this.authenticateBiometric();

    if (!success) {
      throw new Error("Biometric authentication failed");
    }

    return await passwords.getPassword(service, key);
  }

  async setBiometricKey(service: string, key: string, value: string): Promise<void> {
    if (await this.valueUpToDate(service, key, value)) {
      return;
    }

    return await passwords.setPassword(service, key, value);
  }

  async deleteBiometricKey(service: string, key: string): Promise<void> {
    try {
      await passwords.deletePassword(service, key);
    } catch (e) {
      if (e instanceof Error && e.message === passwords.PASSWORD_NOT_FOUND) {
        this.logService.debug(`Biometric key ${key} not found for service ${service}.`);
      }
      throw e;
    }
  }

  private async valueUpToDate(service: string, key: string, value: string): Promise<boolean> {
    try {
      const existing = await passwords.getPassword(service, key);
      return existing === value;
    } catch {
      return false;
    }
  }

  async osBiometricsNeedsSetup() {
    return false;
  }

  async osBiometricsCanAutoSetup(): Promise<boolean> {
    return false;
  }

  async osBiometricsSetup(): Promise<void> {}
}
