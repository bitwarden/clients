import { inject, Injectable } from "@angular/core";

import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { RotateableKeySet } from "@bitwarden/common/key-management/keys/models/rotateable-key-set";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { KeyService } from "@bitwarden/key-management";

@Injectable({ providedIn: "root" })
export class RotateableKeySetService {
  private readonly keyService = inject(KeyService);
  private readonly encryptService = inject(EncryptService);

  /**
   * Create a new rotatable key set for the provided rotateableKey, using the provided external key.
   * For more information on rotatable key sets, see {@link RotateableKeySet}
   * @param rotateableKey The symmetric key to be contained within the `RotateableKeySet`.
   * @param externalKey The `ExternalKey` used to encrypt {@link RotateableKeySet.encryptedPrivateKey}
   * @returns RotateableKeySet containing the provided symmetric rotateableKey.
   */
  async createKeySet<ExternalKey extends SymmetricCryptoKey>(
    rotateableKey: SymmetricCryptoKey,
    externalKey: ExternalKey,
  ): Promise<RotateableKeySet<ExternalKey>> {
    const [publicKey, encryptedPrivateKey] = await this.keyService.makeKeyPair(externalKey);

    const rawPublicKey = Utils.fromB64ToArray(publicKey);
    const encryptedRotateableKey = await this.encryptService.encapsulateKeyUnsigned(
      rotateableKey,
      rawPublicKey,
    );
    const encryptedPublicKey = await this.encryptService.wrapEncapsulationKey(
      rawPublicKey,
      rotateableKey,
    );
    return new RotateableKeySet(encryptedRotateableKey, encryptedPublicKey, encryptedPrivateKey);
  }

  /**
   * Rotates the provided `RotateableKeySet` with the new key.
   *
   * @param keySet The current `RotateableKeySet` to be rotated.
   * @param oldRotateableKey The current rotateableKey used to decrypt the `PublicKey`.
   * @param newRotateableKey The new rotateableKey to encrypt the `PublicKey`.
   * @returns The updated `RotateableKeySet` that contains the new rotateableKey.
   */
  async rotateKeySet<ExternalKey extends SymmetricCryptoKey>(
    keySet: RotateableKeySet<ExternalKey>,
    oldRotateableKey: SymmetricCryptoKey,
    newRotateableKey: SymmetricCryptoKey,
  ): Promise<RotateableKeySet<ExternalKey>> {
    // validate parameters
    if (!keySet) {
      throw new Error("failed to rotate key set: keySet is required");
    }
    if (!oldRotateableKey) {
      throw new Error("failed to rotate key set: oldRotateableKey is required");
    }
    if (!newRotateableKey) {
      throw new Error("failed to rotate key set: newRotateableKey is required");
    }

    const publicKey = await this.encryptService.unwrapEncapsulationKey(
      keySet.encryptedPublicKey,
      oldRotateableKey,
    );
    if (publicKey == null) {
      throw new Error("failed to rotate key set: could not decrypt public key");
    }
    const newEncryptedPublicKey = await this.encryptService.wrapEncapsulationKey(
      publicKey,
      newRotateableKey,
    );
    const newEncryptedRotateableKey = await this.encryptService.encapsulateKeyUnsigned(
      newRotateableKey,
      publicKey,
    );

    const newRotateableKeySet = new RotateableKeySet<ExternalKey>(
      newEncryptedRotateableKey,
      newEncryptedPublicKey,
      keySet.encryptedPrivateKey,
    );

    return newRotateableKeySet;
  }
}
