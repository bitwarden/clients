// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";

import { Utils } from "../../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { EncryptService } from "../../crypto/abstractions/encrypt.service";
import { RotateableKeySet } from "../models/rotateable-key-set";

import { RotateableKeySetService } from "./abstractions/rotateable-key-set.service";

export class DefaultRotateableKeySetService implements RotateableKeySetService {
  constructor(
    private keyService: KeyService,
    private encryptService: EncryptService,
  ) {}

  async createKeySet<ExternalKey extends SymmetricCryptoKey>(
    rotateableKey: SymmetricCryptoKey,
    externalKey: ExternalKey,
  ): Promise<RotateableKeySet<ExternalKey>> {
    if (!rotateableKey) {
      throw new Error("failed to create key set: rotateableKey is required");
    }
    if (!externalKey) {
      throw new Error("failed to create key set: externalKey is required");
    }

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
