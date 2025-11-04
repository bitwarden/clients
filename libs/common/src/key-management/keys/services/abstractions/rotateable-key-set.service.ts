import { SymmetricCryptoKey } from "../../../../platform/models/domain/symmetric-crypto-key";
import { RotateableKeySet } from "../../models/rotateable-key-set";

export abstract class RotateableKeySetService {
  /**
   * Create a new rotatable key set for the provided rotateableKey, using the provided external key.
   * For more information on rotatable key sets, see {@link RotateableKeySet}
   * @param rotateableKey The symmetric key to be contained within the `RotateableKeySet`.
   * @param externalKey The `ExternalKey` used to encrypt {@link RotateableKeySet.encryptedPrivateKey}
   * @returns RotateableKeySet containing the provided symmetric rotateableKey.
   */
  abstract createKeySet<ExternalKey extends SymmetricCryptoKey>(
    rotateableKey: SymmetricCryptoKey,
    externalKey: ExternalKey,
  ): Promise<RotateableKeySet<ExternalKey>>;

  /**
   * Rotates the provided `RotateableKeySet` with the new key.
   *
   * @param keySet The current `RotateableKeySet` to be rotated.
   * @param oldRotateableKey The current rotateableKey used to decrypt the `PublicKey`.
   * @param newRotateableKey The new rotateableKey to encrypt the `PublicKey`.
   * @returns The updated `RotateableKeySet` that contains the new rotateableKey.
   */
  abstract rotateKeySet<ExternalKey extends SymmetricCryptoKey>(
    keySet: RotateableKeySet<ExternalKey>,
    oldRotateableKey: SymmetricCryptoKey,
    newRotateableKey: SymmetricCryptoKey,
  ): Promise<RotateableKeySet<ExternalKey>>;
}
