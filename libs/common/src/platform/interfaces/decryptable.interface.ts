import { UserId } from "@bitwarden/user-core";

import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";

import { InitializerMetadata } from "./initializer-metadata.interface";

/**
 * An object that contains EncStrings and knows how to decrypt them. This is usually a domain object with the
 * corresponding view object as the type argument.
 * @example Cipher implements Decryptable<CipherView>
 */
export interface Decryptable<TDecrypted extends InitializerMetadata> extends InitializerMetadata {
  /** @deprecated - Encryption and decryption of domain objects should be implemented in the SDK */
  decrypt: (key: SymmetricCryptoKey, userId?: UserId) => Promise<TDecrypted>;
}
