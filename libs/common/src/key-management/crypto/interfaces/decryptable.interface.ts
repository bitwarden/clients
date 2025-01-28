import { InitializerMetadata } from "../../../platform/interfaces/initializer-metadata.interface";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";

/**
 * An object that contains EncStrings and knows how to decrypt them. This is usually a domain object with the
 * corresponding view object as the type argument.
 * @example Cipher implements Decryptable<CipherView>
 */
export interface Decryptable<TDecrypted extends InitializerMetadata> extends InitializerMetadata {
  decrypt: (key: SymmetricCryptoKey) => Promise<TDecrypted>;
}
