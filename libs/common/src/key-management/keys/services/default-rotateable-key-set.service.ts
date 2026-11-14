// eslint-disable-next-line no-restricted-imports
import {
  EncryptService,
  LegacyCompatKeyService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";

import { Utils } from "../../../platform/misc/utils";
import { RotateableKeySet } from "../models/rotateable-key-set";

import { RotateableKeySetService } from "./abstractions/rotateable-key-set.service";

export class DefaultRotateableKeySetService implements RotateableKeySetService {
  constructor(
    private legacyCompatKeyService: LegacyCompatKeyService,
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

    const [publicKey, encryptedPrivateKey] =
      await this.legacyCompatKeyService.makeKeyPair(upstreamKey);

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
}
