import { spawn } from "child_process";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { biometrics, passwords } from "@bitwarden/desktop-napi";

import { WindowMain } from "../../main/window.main";
import { isFlatpak, isLinux, isSnapStore } from "../../utils";

import { OsBiometricService } from "./os-biometrics.service";

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

export default class OsBiometricsServiceLinux implements OsBiometricService {
  constructor(
    private i18nservice: I18nService,
    private windowMain: WindowMain,
  ) {}
  private _iv: string | null = null;
  // Use getKeyMaterial helper instead of direct access
  private _osKeyHalf: string | null = null;

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
    storageKey: string,
    clientKeyPartB64: string | undefined,
  ): Promise<string | null> {
    const success = await this.authenticateBiometric();

    if (!success) {
      throw new Error("Biometric authentication failed");
    }

    const value = await passwords.getPassword(service, storageKey);

    if (value == null || value == "") {
      return null;
    } else {
      const encValue = new EncString(value);
      this.setIv(encValue.iv);
      const storageDetails = await this.getStorageDetails({ clientKeyHalfB64: clientKeyPartB64 });
      const storedValue = await biometrics.getBiometricSecret(
        service,
        storageKey,
        storageDetails.key_material,
      );
      return storedValue;
    }
  }

  async authenticateBiometric(): Promise<boolean> {
    const hwnd = Buffer.from("");
    return await biometrics.prompt(hwnd, "");
  }

  async osSupportsBiometric(): Promise<boolean> {
    // We assume all linux distros have some polkit implementation
    // that either has bitwarden set up or not, which is reflected in osBiomtricsNeedsSetup.
    // Snap does not have access at the moment to polkit
    // This could be dynamically detected on dbus in the future.
    // We should check if a libsecret implementation is available on the system
    // because otherwise we cannot offlod the protected userkey to secure storage.
    return await passwords.isAvailable();
  }

  async osBiometricsNeedsSetup(): Promise<boolean> {
    if (isSnapStore()) {
      return false;
    }

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
    const process = spawn("pkexec", [
      "bash",
      "-c",
      `echo '${polkitPolicy}' > ${policyPath + policyFileName} && chown root:root ${policyPath + policyFileName} && chcon system_u:object_r:usr_t:s0 ${policyPath + policyFileName}`,
    ]);

    await new Promise((resolve, reject) => {
      process.on("close", (code) => {
        if (code !== 0) {
          reject("Failed to set up polkit policy");
        } else {
          resolve(null);
        }
      });
    });
  }

  // Nulls out key material in order to force a re-derive. This should only be used in getBiometricKey
  // when we want to force a re-derive of the key material.
  private setIv(iv?: string) {
    this._iv = iv ?? null;
    this._osKeyHalf = null;
  }

  private async getStorageDetails({
    clientKeyHalfB64,
  }: {
    clientKeyHalfB64: string | undefined;
  }): Promise<{ key_material: biometrics.KeyMaterial; ivB64: string }> {
    if (this._osKeyHalf == null) {
      const keyMaterial = await biometrics.deriveKeyMaterial(this._iv);
      // osKeyHalf is based on the iv and in contrast to windows is not locked behind user verification!
      this._osKeyHalf = keyMaterial.keyB64;
      this._iv = keyMaterial.ivB64;
    }

    if (this._iv == null) {
      throw new Error("Initialization Vector is null");
    }

    return {
      key_material: {
        osKeyPartB64: this._osKeyHalf,
        clientKeyPartB64: clientKeyHalfB64,
      },
      ivB64: this._iv,
    };
  }
}
