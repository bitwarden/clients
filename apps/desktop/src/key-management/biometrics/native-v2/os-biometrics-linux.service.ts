import { spawn } from "child_process";

import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { biometrics_v2, passwords } from "@bitwarden/desktop-napi";
import { BiometricsStatus } from "@bitwarden/key-management";

import { isSnapStore, isFlatpak, isLinux } from "../../../utils";
import { OsBiometricService } from "../os-biometrics.service";

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
  private biometricsSystem: biometrics_v2.BiometricLockSystem;

  constructor() {
    this.biometricsSystem = biometrics_v2.initBiometricSystem();
  }

  async setBiometricKey(userId: UserId, key: SymmetricCryptoKey): Promise<void> {
    await biometrics_v2.provideKey(
      this.biometricsSystem,
      userId,
      Buffer.from(key.toEncoded().buffer),
    );
  }

  async deleteBiometricKey(userId: UserId): Promise<void> {
    await biometrics_v2.unenroll(this.biometricsSystem, userId);
  }

  async getBiometricKey(userId: UserId): Promise<SymmetricCryptoKey | null> {
    const result = await biometrics_v2.unlock(this.biometricsSystem, userId, Buffer.from(""));
    return result ? new SymmetricCryptoKey(Uint8Array.from(result)) : null;
  }

  async authenticateBiometric(): Promise<boolean> {
    return await biometrics_v2.authenticate(
      this.biometricsSystem,
      Buffer.from(""),
      "Authenticate to unlock",
    );
  }

  async supportsBiometrics(): Promise<boolean> {
    // We assume all linux distros have some polkit implementation
    // that either has bitwarden set up or not, which is reflected in osBiomtricsNeedsSetup.
    // Snap does not have access at the moment to polkit
    // This could be dynamically detected on dbus in the future.
    // We should check if a libsecret implementation is available on the system
    // because otherwise we cannot offlod the protected userkey to secure storage.
    return await passwords.isAvailable();
  }

  async needsSetup(): Promise<boolean> {
    if (isSnapStore()) {
      return false;
    }

    // check whether the polkit policy is loaded via dbus call to polkit
    return !(await biometrics_v2.authenticateAvailable(this.biometricsSystem));
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
    return (await biometrics_v2.unlockAvailable(this.biometricsSystem, userId))
      ? BiometricsStatus.Available
      : BiometricsStatus.UnlockNeeded;
  }

  async enrollPersistent(userId: UserId, key: SymmetricCryptoKey): Promise<void> {}

  async hasPersistentKey(userId: UserId): Promise<boolean> {
    return false;
  }
}
