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

  async createKeySet<UpstreamKey extends SymmetricCryptoKey>(
    upstreamKey: UpstreamKey,
    downstreamKey: SymmetricCryptoKey,
  ): Promise<RotateableKeySet<UpstreamKey>> {
    if (!upstreamKey) {
      throw new Error("failed to create key set: upstreamKey is required");
    }
    if (!downstreamKey) {
      throw new Error("failed to create key set: downstreamKey is required");
    }

    const [publicKey, encryptedPrivateKey] = await this.keyService.makeKeyPair(upstreamKey);

    const rawPublicKey = Utils.fromB64ToArray(publicKey);
    const encryptedRotateableKey = await this.encryptService.encapsulateKeyUnsigned(
      downstreamKey,
      rawPublicKey,
    );
    const encryptedPublicKey = await this.encryptService.wrapEncapsulationKey(
      rawPublicKey,
      downstreamKey,
    );
    return new RotateableKeySet(encryptedRotateableKey, encryptedPublicKey, encryptedPrivateKey);
  }

  async rotateKeySet<UpstreamKey extends SymmetricCryptoKey>(
    keySet: RotateableKeySet<UpstreamKey>,
    oldDownstreamKey: SymmetricCryptoKey,
    newDownstreamKey: SymmetricCryptoKey,
  ): Promise<RotateableKeySet<UpstreamKey>> {
    // validate parameters
    if (!keySet) {
      throw new Error("failed to rotate key set: keySet is required");
    }
    if (!oldDownstreamKey) {
      throw new Error("failed to rotate key set: oldDownstreamKey is required");
    }
    if (!newDownstreamKey) {
      throw new Error("failed to rotate key set: newDownstreamKey is required");
    }

    const publicKey = await this.encryptService.unwrapEncapsulationKey(
      keySet.encryptedPublicKey,
      oldDownstreamKey,
    );
    if (publicKey == null) {
      throw new Error("failed to rotate key set: could not decrypt public key");
    }
    const newEncryptedPublicKey = await this.encryptService.wrapEncapsulationKey(
      publicKey,
      newDownstreamKey,
    );
    const newEncryptedRotateableKey = await this.encryptService.encapsulateKeyUnsigned(
      newDownstreamKey,
      publicKey,
    );

    const newRotateableKeySet = new RotateableKeySet<UpstreamKey>(
      newEncryptedRotateableKey,
      newEncryptedPublicKey,
      keySet.encryptedPrivateKey,
    );

    return newRotateableKeySet;
  }
}
