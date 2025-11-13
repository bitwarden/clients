import { SymmetricCryptoKey } from "../../../../platform/models/domain/symmetric-crypto-key";
import { RotateableKeySet } from "../../models/rotateable-key-set";

export abstract class RotateableKeySetService {
  /**
   * Create a new rotatable key set for the provided downstreamKey, using the provided upstream key.
   * For more information on rotatable key sets, see {@link RotateableKeySet}
   * @param upstreamKey The `UpstreamKey` used to encrypt {@link RotateableKeySet.encryptedPrivateKey}
   * @param downstreamKey The symmetric key to be contained within the `RotateableKeySet`.
   * @returns RotateableKeySet containing the provided symmetric downstreamKey.
   */
  abstract createKeySet<UpstreamKey extends SymmetricCryptoKey>(
    upstreamKey: UpstreamKey,
    downstreamKey: SymmetricCryptoKey,
  ): Promise<RotateableKeySet<UpstreamKey>>;

  /**
   * Rotates the provided `RotateableKeySet` with the new key.
   *
   * @param keySet The current `RotateableKeySet` to be rotated.
   * @param oldDownstreamKey The current downstreamKey used to decrypt the `PublicKey`.
   * @param newDownstreamKey The new downstreamKey to encrypt the `PublicKey`.
   * @returns The updated `RotateableKeySet` that contains the new downstreamKey.
   */
  abstract rotateKeySet<UpstreamKey extends SymmetricCryptoKey>(
    keySet: RotateableKeySet<UpstreamKey>,
    oldDownstreamKey: SymmetricCryptoKey,
    newDownstreamKey: SymmetricCryptoKey,
  ): Promise<RotateableKeySet<UpstreamKey>>;
}
