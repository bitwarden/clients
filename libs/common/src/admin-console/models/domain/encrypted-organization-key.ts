import { EncryptService, EncString, SymmetricCryptoKey } from "@bitwarden/key-management";

import { OrgKey, UserPrivateKey } from "../../../types/key";
import { EncryptedOrganizationKeyData } from "../data/encrypted-organization-key.data";

export abstract class BaseEncryptedOrganizationKey {
  abstract get encryptedOrganizationKey(): EncString;

  static fromData(data: EncryptedOrganizationKeyData) {
    switch (data.type) {
      case "organization":
        return new EncryptedOrganizationKey(data.key);

      case "provider":
        return new ProviderEncryptedOrganizationKey(data.key, data.providerId);

      default:
        return null;
    }
  }

  static isProviderEncrypted(
    key: EncryptedOrganizationKey | ProviderEncryptedOrganizationKey,
  ): key is ProviderEncryptedOrganizationKey {
    return key.toData().type === "provider";
  }
}

export class EncryptedOrganizationKey implements BaseEncryptedOrganizationKey {
  constructor(private key: string) {}

  async decrypt(encryptService: EncryptService, privateKey: UserPrivateKey) {
    const decValue = await encryptService.rsaDecrypt(this.encryptedOrganizationKey, privateKey);
    return new SymmetricCryptoKey(decValue) as OrgKey;
  }

  get encryptedOrganizationKey() {
    return new EncString(this.key);
  }

  toData(): EncryptedOrganizationKeyData {
    return {
      type: "organization",
      key: this.key,
    };
  }
}

export class ProviderEncryptedOrganizationKey implements BaseEncryptedOrganizationKey {
  constructor(
    private key: string,
    private providerId: string,
  ) {}

  async decrypt(encryptService: EncryptService, providerKeys: Record<string, SymmetricCryptoKey>) {
    const decValue = await encryptService.decryptToBytes(
      new EncString(this.key),
      providerKeys[this.providerId],
    );
    return new SymmetricCryptoKey(decValue) as OrgKey;
  }

  get encryptedOrganizationKey() {
    return new EncString(this.key);
  }

  toData(): EncryptedOrganizationKeyData {
    return {
      type: "provider",
      key: this.key,
      providerId: this.providerId,
    };
  }
}
