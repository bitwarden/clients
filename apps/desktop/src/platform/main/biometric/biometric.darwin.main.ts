import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { biometrics, passwords } from "@bitwarden/desktop-native";

import { WindowMain } from "../../../main/window.main";

import { OsBiometricService } from "./biometrics.service.abstraction";

export default class BiometricDarwinMain implements OsBiometricService {
  constructor(
    private i18nService: I18nService,
    private windowMain: WindowMain,
    private stateService: StateService,
  ) {}

  async init() {
    await this.stateService.setBiometricText("unlockWithTouchId");
    await this.stateService.setNoAutoPromptBiometricsText("autoPromptTouchId");
  }

  async osSupportsBiometric(): Promise<boolean> {
    return await biometrics.available();
  }

  async authenticateBiometric(): Promise<boolean> {
    const hwnd = this.windowMain.win.getNativeWindowHandle();
    return await biometrics.prompt(hwnd, this.i18nService.t("touchIdConsentMessage"));
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
    return await passwords.deletePassword(service, key);
  }

  private async valueUpToDate(service: string, key: string, value: string): Promise<boolean> {
    try {
      const existing = await passwords.getPassword(service, key);
      return existing === value;
    } catch {
      return false;
    }
  }
}
