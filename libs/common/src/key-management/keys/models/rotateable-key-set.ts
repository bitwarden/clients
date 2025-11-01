// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { PrfKey } from "../../../types/key";
import { EncString } from "../../crypto/models/enc-string";

declare const tag: unique symbol;

/**
 * A set of keys where a symmetric `RotateableKey` is protected by an encrypted public/private key-pair.
 * The `RotateableKey` is used to encrypt/decrypt data, while the public/private key-pair is
 * used to rotate the `RotateableKey`.
 *
 * The `PrivateKey` is protected by an `ExternalKey`, such as a `DeviceKey`, or `PrfKey`,
 * and the `PublicKey` is protected by the `RotateableKey`. This setup allows:
 *
 *   - Access to `RotateableKey` by knowing the `ExternalKey`
 *   - Rotation to a new `RotateableKey` by knowing the current `RotateableKey`,
 *     without needing access to the `ExternalKey`
 */
export class RotateableKeySet<ExternalKey extends SymmetricCryptoKey = SymmetricCryptoKey> {
  private readonly [tag]: ExternalKey;

  constructor(
    /** PublicKey encrypted RotateableKey */
    readonly encryptedRotateableKey: EncString,

    /** RotateableKey encrypted PublicKey */
    readonly encryptedPublicKey: EncString,

    /** ExternalKey encrypted PrivateKey */
    readonly encryptedPrivateKey?: EncString,
  ) {}
}

export type PrfKeySet = RotateableKeySet<PrfKey>;
