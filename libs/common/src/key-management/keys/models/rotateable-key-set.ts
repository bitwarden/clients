import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { PrfKey } from "../../../types/key";
import { EncString } from "../../crypto/models/enc-string";

declare const tag: unique symbol;

/**
 * A set of keys where a symmetric `DownstreamKey` is protected by an encrypted public/private key-pair.
 * The `DownstreamKey` is used to encrypt/decrypt data, while the public/private key-pair is
 * used to rotate the `DownstreamKey`.
 *
 * The `PrivateKey` is protected by an `UpstreamKey`, such as a `DeviceKey`, or `PrfKey`,
 * and the `PublicKey` is protected by the `DownstreamKey`. This setup allows:
 *
 *   - Access to `DownstreamKey` by knowing the `UpstreamKey`
 *   - Rotation to a new `DownstreamKey` by knowing the current `DownstreamKey`,
 *     without needing access to the `UpstreamKey`
 */
export class RotateableKeySet<UpstreamKey extends SymmetricCryptoKey = SymmetricCryptoKey> {
  private readonly [tag]!: UpstreamKey;

  constructor(
    /** `DownstreamKey` protected by publicKey */
    readonly encapsulatedDownstreamKey: EncString,

    /** DownstreamKey encrypted PublicKey */
    readonly encryptedPublicKey: EncString,

    /** UpstreamKey encrypted PrivateKey */
    readonly encryptedPrivateKey?: EncString,
  ) {}
}

export type PrfKeySet = RotateableKeySet<PrfKey>;
