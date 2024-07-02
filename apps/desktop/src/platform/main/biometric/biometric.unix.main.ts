import { spawn } from "child_process";

import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { biometrics, passwords } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../../main/window.main";
import { isFlatpak, isLinux, isSnapStore } from "../../../utils";

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
        <allow_any>no</allow_any>
        <allow_inactive>no</allow_inactive>
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
    private cryptoFunctionService: CryptoFunctionService,
  ) {}

  async setBiometricKey(
    service: string,
    key: string,
    value: string,
    clientKeyPartB64: string | undefined,
  ): Promise<void> {
    const storageDetails = await this.getStorageDetails({ clientKeyHalfB64: clientKeyPartB64 });
    await biometrics.setBiometricSecret(
      service,
      key,
      value,
      storageDetails.key_material,
      storageDetails.ivB64,
    );
  }
  async deleteBiometricKey(service: string, key: string): Promise<void> {
    await passwords.deletePassword(service, key);
  }

  async getBiometricKey(
    service: string,
    key: string,
    clientKeyPartB64: string | undefined,
  ): Promise<string> {
    const success = await this.authenticateBiometric();

    if (!success) {
      throw new Error("Biometric authentication failed");
    }

    const storageDetails = await this.getStorageDetails({ clientKeyHalfB64: clientKeyPartB64 });
    const storedValue = await biometrics.getBiometricSecret(
      service,
      key,
      storageDetails.key_material,
    );
    return storedValue;
  }

  async authenticateBiometric(): Promise<boolean> {
    const hwnd = this.windowMain.win.getNativeWindowHandle();
    return await biometrics.prompt(hwnd, this.i18nservice.t("polkitConsentMessage"));
  }

  async osSupportsBiometric(): Promise<boolean> {
    // We assume all linux distros have some polkit implementation
    // that either has bitwarden set up or not, which is reflected in osBiomtricsNeedsSetup.
    // This could be dynamically detected on dbus in the future.
    // We should check if a libsecret implementation is available on the system
    // because otherwise we cannot offlod the protected userkey to secure storage.
    return await passwords.isAvailable();
  }

  async osBiometricsNeedsSetup(): Promise<boolean> {
    // check whether the polkit policy is loaded via dbus call to polkit
    return !(await biometrics.available());
  }

  async osBiometricsCanAutoSetup(): Promise<boolean> {
    // We cannot auto setup on snap or flatpak since the filesystem is sandboxed.
    // The user needs to manually set up the polkit policy outside of the sandbox
    // since we allow access to polkit via dbus for the sandboxed clients, the authentication works from
    // the sandbox, once the policy is set up outside of the sandbox.
    return isLinux() && !isSnapStore() && !isFlatpak();
  }

  async osBiometricsSetup(): Promise<void> {
    let process = spawn("pkexec", [
      "bash",
      "-c",
      `echo '${polkitPolicy}' > ${policyPath + policyFileName}`,
    ]);

    await new Promise((resolve, reject) => {
      process.on("close", (code) => {
        if (code !== 0) {
          reject("Failed to set up polkit policy");
        } else {
          process = spawn("pkexec", ["chown", "root:root", policyPath + policyFileName]);
          process.on("close", (code) => {
            if (code !== 0) {
              reject("Failed to change polkit policy permissions");
            } else {
              // selinux requires labeling
              process = spawn("pkexec", [
                "chcon",
                "system_u:object_r:usr_t:s0",
                policyPath + policyFileName,
              ]);
              // fail silently
              resolve(null);
            }
          });
        }
      });
    });
  }

  private async getStorageDetails({
    clientKeyHalfB64,
  }: {
    clientKeyHalfB64: string;
  }): Promise<{ key_material: biometrics.KeyMaterial; ivB64: string }> {
    const iv = (await this.cryptoFunctionService.randomBytes(16)).buffer;
    const ivB64 = Utils.fromBufferToB64(iv);

    return {
      key_material: {
        osKeyPartB64: clientKeyHalfB64,
      },
      ivB64: ivB64,
    };
  }
}
