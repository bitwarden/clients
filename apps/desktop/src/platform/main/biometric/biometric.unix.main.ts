import { spawn } from "child_process";
import { existsSync } from "fs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { biometrics, passwords } from "@bitwarden/desktop-native";

import { WindowMain } from "../../../main/window.main";

import { OsBiometricService } from "./biometrics.service.abstraction";

const polkitPolicy = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE policyconfig PUBLIC
 "-//freedesktop//DTD PolicyKit Policy Configuration 1.0//EN"
 "http://www.freedesktop.org/standards/PolicyKit/1.0/policyconfig.dtd">

<policyconfig>
    <action id="com.bitwarden.Bitwarden.unlock">
      <description>Unlock Bitwarden</description>
      <message>Authenticate to unlock Bitwarden</message>
      <defaults>
        <allow_any>auth_self</allow_any>
        <allow_inactive>auth_self</allow_inactive>
        <allow_active>auth_self</allow_active>
      </defaults>
    </action>
</policyconfig>`;
const policyFileName = "com.bitwarden.Bitwarden.policy";
const policyPath = "/usr/share/polkit-1/actions/";

export default class BiometricUnixMain implements OsBiometricService {
  constructor(
    private i18nservice: I18nService,
    private windowMain: WindowMain,
    private stateService: StateService
  ) {}

  async init() {
    await this.stateService.setBiometricText("unlockWithPolkit");
    await this.stateService.setNoAutoPromptBiometricsText("autoPromptPolkit");
  }

  async setBiometricKey(service: string, key: string, value: string): Promise<void> {
    return await passwords.setPassword(service, key, value);
  }
  async deleteBiometricKey(service: string, key: string): Promise<void> {
    await passwords.deletePassword(service, key);
  }

  async getBiometricKey(service: string, key: string): Promise<string> {
    const success = await this.authenticateBiometric();

    if (!success) {
      throw new Error("Biometric authentication failed");
    }

    return await passwords.getPassword(service, key);
  }

  async authenticateBiometric(): Promise<boolean> {
    const hwnd = this.windowMain.win.getNativeWindowHandle();
    return await biometrics.prompt(hwnd, this.i18nservice.t("polkitConsentMessage"));
  }

  async osSupportsBiometric(): Promise<boolean> {
    return existsSync(policyPath);
  }

  async osBiometricsNeedsSetup(): Promise<boolean> {
    return !existsSync(policyPath + policyFileName);
  }

  async osBiometricsSetup(): Promise<void> {
    const process = spawn("pkexec", [
      "bash",
      "-c",
      `echo '${polkitPolicy}' > ${policyPath + policyFileName}`,
    ]);
    process.on("close", (code) => {
      if (code !== 0) {
        throw new Error("Failed to set up polkit policy");
      }
    });
  }
}
