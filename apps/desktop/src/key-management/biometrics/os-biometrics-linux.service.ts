import { spawn } from "child_process";

import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { BiometricsStatus } from "@bitwarden/key-management";

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
  constructor() {}
  private inMemoryUserKeys = new Map<string, SymmetricCryptoKey>();

  async setBiometricKey(userId: UserId, key: SymmetricCryptoKey): Promise<void> {
    this.inMemoryUserKeys.set(userId.toString(), key);
  }
  async deleteBiometricKey(userId: UserId): Promise<void> {
    this.inMemoryUserKeys.delete(userId.toString());
  }

  async getBiometricKey(userId: UserId): Promise<SymmetricCryptoKey | null> {
    const success = await this.authenticateBiometric();

    if (!success) {
      throw new Error("Biometric authentication failed");
    }

    return this.inMemoryUserKeys.get(userId.toString()) || null;
  }

  async authenticateBiometric(): Promise<boolean> {
    const hwnd = Buffer.from("");
    return await biometrics.prompt(hwnd, "");
  }

  async supportsBiometrics(): Promise<boolean> {
    // We assume all linux distros have some polkit implementation
    // that either has bitwarden set up or not, which is reflected in osBiomtricsNeedsSetup.
    // This could be dynamically detected on dbus in the future.
    return true;
  }

  async needsSetup(): Promise<boolean> {
    if (isSnapStore()) {
      return false;
    }

    // check whether the polkit policy is loaded via dbus call to polkit
    return !(await biometrics.available());
  }

  async canAutoSetup(): Promise<boolean> {
    // We cannot auto setup on snap or flatpak since the filesystem is sandboxed.
    // The user needs to manually set up the polkit policy outside of the sandbox
    // since we allow access to polkit via dbus for the sandboxed clients, the authentication works from
    // the sandbox, once the policy is set up outside of the sandbox.
    return isLinux() && !isSnapStore() && !isFlatpak();
  }

  async runSetup(): Promise<void> {
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

  async getBiometricsFirstUnlockStatusForUser(userId: UserId): Promise<BiometricsStatus> {
    const hasUserKey = this.inMemoryUserKeys.has(userId.toString());
    if (hasUserKey) {
      return BiometricsStatus.Available;
    } else {
      return BiometricsStatus.UnlockNeeded;
    }
  }
}
