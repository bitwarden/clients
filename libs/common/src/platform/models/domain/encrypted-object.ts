import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";

export class EncryptedObject {
  iv: Uint8Array;
  data: Uint8Array;
  mac: Uint8Array;
  key: SymmetricCryptoKey;
}
