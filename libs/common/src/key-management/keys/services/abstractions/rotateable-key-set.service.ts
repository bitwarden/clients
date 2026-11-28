// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

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
}
