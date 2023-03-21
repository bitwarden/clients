import { CryptoService } from "../../abstractions/crypto.service";
import { Guid } from "../../types/guid";
import { EncryptedOrganizationKeyData } from "../data/encrypted-organization-key.data";

import { EncString } from "./enc-string";
import { SymmetricCryptoKey } from "./symmetric-crypto-key";

export abstract class BaseEncryptedOrganizationKey {
  decrypt: (cryptoService: CryptoService) => Promise<SymmetricCryptoKey>;

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
}

export class EncryptedOrganizationKey implements BaseEncryptedOrganizationKey {
  constructor(private key: string) {}

  async decrypt(cryptoService: CryptoService) {
    const decValue = await cryptoService.rsaDecrypt(this.key);
    return new SymmetricCryptoKey(decValue);
  }

  toData(): EncryptedOrganizationKeyData {
    return {
      type: "organization",
      key: this.key,
    };
  }
}

export class ProviderEncryptedOrganizationKey implements BaseEncryptedOrganizationKey {
  constructor(private key: string, private providerId: Guid) {}

  async decrypt(cryptoService: CryptoService) {
    const providerKey = await cryptoService.getProviderKey(this.providerId);
    const decValue = await cryptoService.decryptToBytes(new EncString(this.key), providerKey);
    return new SymmetricCryptoKey(decValue);
  }

  toData(): EncryptedOrganizationKeyData {
    return {
      type: "provider",
      key: this.key,
      providerId: this.providerId,
    };
  }
}
