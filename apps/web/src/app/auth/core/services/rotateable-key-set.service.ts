import { inject, Injectable } from "@angular/core";

import { RotateableKeySet } from "@bitwarden/auth/common";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { KeyService } from "@bitwarden/key-management";

@Injectable({ providedIn: "root" })
export class RotateableKeySetService {
  private readonly keyService = inject(KeyService);
  private readonly encryptService = inject(EncryptService);

  /**
   * Create a new rotateable key set for the current user, using the provided external key.
   * For more information on rotateable key sets, see {@link RotateableKeySet}
   *
   * @param externalKey The `ExternalKey` used to encrypt {@link RotateableKeySet.encryptedPrivateKey}
   * @returns RotateableKeySet containing the current users `UserKey`
   */
  async createKeySet<ExternalKey extends SymmetricCryptoKey>(
    externalKey: ExternalKey,
  ): Promise<RotateableKeySet<ExternalKey>> {
    const [publicKey, encryptedPrivateKey] = await this.keyService.makeKeyPair(externalKey);

    const userKey = await this.keyService.getUserKey();
    const rawPublicKey = Utils.fromB64ToArray(publicKey);
    const encryptedUserKey = await this.encryptService.rsaEncrypt(userKey.key, rawPublicKey);
    const encryptedPublicKey = await this.encryptService.encrypt(rawPublicKey, userKey);
    return new RotateableKeySet(encryptedUserKey, encryptedPublicKey, encryptedPrivateKey);
  }

  /**
   * Rotates the current user's `UserKey` and updates the provided `RotateableKeySet` with the new keys.
   *
   * @param keySet The current `RotateableKeySet` for the user
   * @returns The updated `RotateableKeySet` with the new `UserKey`
   */
  async rotateKeySet<ExternalKey extends SymmetricCryptoKey>(
    keySet: RotateableKeySet<ExternalKey>,
    oldUserKey: SymmetricCryptoKey,
    newUserKey: SymmetricCryptoKey,
  ): Promise<RotateableKeySet<ExternalKey>> {
    // validate parameters
    if (!keySet) {
      throw new Error("failed to rotate key set: keySet is required");
    }
    if (!oldUserKey) {
      throw new Error("failed to rotate key set: oldUserKey is required");
    }
    if (!newUserKey) {
      throw new Error("failed to rotate key set: newUserKey is required");
    }

    const publicKey = await this.encryptService.decryptToBytes(
      keySet.encryptedPublicKey,
      oldUserKey,
    );
    if (publicKey == null) {
      throw new Error("failed to rotate key set: could not decrypt public key");
    }
    const newEncryptedPublicKey = await this.encryptService.encrypt(publicKey, newUserKey);
    const newEncryptedUserKey = await this.encryptService.rsaEncrypt(newUserKey.key, publicKey);

    const newRotateableKeySet = new RotateableKeySet<ExternalKey>(
      newEncryptedUserKey,
      newEncryptedPublicKey,
      keySet.encryptedPrivateKey,
    );

    return newRotateableKeySet;
  }
}
