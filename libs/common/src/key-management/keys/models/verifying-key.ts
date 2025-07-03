import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { SigningKeyType as SigningKeyAlgorithm } from "../../enums/signing-key-type.enum";

/**
 * A verifying key is a public key used to verify signatures
 */
export class VerifyingKey {
  private innerKey: string;

  constructor(verifyingKey: string) {
    this.innerKey = verifyingKey;
  }

  /**
   * Returns the verifying key in base64 format.
   */
  toString(): string {
    return this.innerKey;
  }

  /**
   * Returns the algorithm of the underlying signature scheme of the verifying key.
   */
  algorithm(): SigningKeyAlgorithm {
    return PureCrypto.key_algorithm_for_verifying_key(Utils.fromB64ToArray(this.innerKey));
  }
}
