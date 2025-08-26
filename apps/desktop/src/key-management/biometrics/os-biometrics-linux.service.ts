import { spawn } from "child_process";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { biometrics, passwords } from "@bitwarden/desktop-napi";
import { BiometricsStatus, BiometricStateService } from "@bitwarden/key-management";

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

const SERVICE = "Bitwarden_biometric";

function getLookupKeyForUser(userId: UserId): string {
  return `${userId}_user_biometric`;
}

export default class OsBiometricsServiceLinux implements OsBiometricService {
  constructor(
    private biometricStateService: BiometricStateService,
    private encryptService: EncryptService,
    private cryptoFunctionService: CryptoFunctionService,
    private logService: LogService,
  ) {}

  private _iv: string | null = null;
  // Use getKeyMaterial helper instead of direct access
  private _osKeyHalf: string | null = null;
  private clientKeyHalves = new Map<UserId, Uint8Array | null>();

  async setBiometricKey(userId: UserId, key: SymmetricCryptoKey): Promise<void> {
    const clientKeyHalf = await this.getOrCreateBiometricEncryptionClientKeyHalf(userId, key);

    const storageDetails = await this.getStorageDetails({
      clientKeyHalfB64: clientKeyHalf ? Utils.fromBufferToB64(clientKeyHalf) : undefined,
    });
    await biometrics.setBiometricSecret(
      SERVICE,
      getLookupKeyForUser(userId),
      key.toBase64(),
      storageDetails.key_material,
      storageDetails.ivB64,
    );
  }

  async deleteBiometricKey(userId: UserId): Promise<void> {
    try {
      await passwords.deletePassword(SERVICE, getLookupKeyForUser(userId));
    } catch (e) {
      if (e instanceof Error && e.message === passwords.PASSWORD_NOT_FOUND) {
        this.logService.debug(
          "[OsBiometricService] Biometric key %s not found for service %s.",
          getLookupKeyForUser(userId),
          SERVICE,
        );
      } else {
        throw e;
      }
    }
  }

  async getBiometricKey(userId: UserId): Promise<SymmetricCryptoKey | null> {
    const success = await this.authenticateBiometric();

    if (!success) {
      throw new Error("Biometric authentication failed");
    }

    const value = await passwords.getPassword(SERVICE, getLookupKeyForUser(userId));

    if (value == null || value == "") {
      return null;
    } else {
      let clientKeyPartB64: string | null = null;
      if (this.clientKeyHalves.has(userId)) {
        clientKeyPartB64 = Utils.fromBufferToB64(this.clientKeyHalves.get(userId)!);
      }
      const encValue = new EncString(value);
      this.setIv(encValue.iv);
      const storageDetails = await this.getStorageDetails({
        clientKeyHalfB64: clientKeyPartB64 ?? undefined,
      });
      const storedValue = await biometrics.getBiometricSecret(
        SERVICE,
        getLookupKeyForUser(userId),
        storageDetails.key_material,
      );
      return SymmetricCryptoKey.fromString(storedValue);
    }
  }

  async authenticateBiometric(): Promise<boolean> {
    const hwnd = Buffer.from("");
    return await biometrics.prompt(hwnd, "");
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

  private async getOrCreateBiometricEncryptionClientKeyHalf(
    userId: UserId,
    key: SymmetricCryptoKey,
  ): Promise<Uint8Array | null> {
    if (this.clientKeyHalves.has(userId)) {
      return this.clientKeyHalves.get(userId) || null;
    }

    // Retrieve existing key half if it exists
    let clientKeyHalf: Uint8Array | null = null;
    const encryptedClientKeyHalf =
      await this.biometricStateService.getEncryptedClientKeyHalf(userId);
    if (encryptedClientKeyHalf != null) {
      clientKeyHalf = await this.encryptService.decryptBytes(encryptedClientKeyHalf, key);
    }
    if (clientKeyHalf == null) {
      // Set a key half if it doesn't exist
      clientKeyHalf = await this.cryptoFunctionService.randomBytes(32);
      const encKey = await this.encryptService.encryptBytes(clientKeyHalf, key);
      await this.biometricStateService.setEncryptedClientKeyHalf(encKey, userId);
    }

    this.clientKeyHalves.set(userId, clientKeyHalf);

    return clientKeyHalf;
  }

  async getBiometricsFirstUnlockStatusForUser(userId: UserId): Promise<BiometricsStatus> {
    if (this.clientKeyHalves.has(userId)) {
      return BiometricsStatus.Available;
    } else {
      return BiometricsStatus.UnlockNeeded;
    }
  }
}
