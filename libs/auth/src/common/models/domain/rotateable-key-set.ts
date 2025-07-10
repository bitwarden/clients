// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { PrfKey } from "@bitwarden/common/types/key";

declare const tag: unique symbol;

/**
 * A set of keys where a `UserKey` is protected by an encrypted public/private key-pair.
 * The `UserKey` is used to encrypt/decrypt data, while the public/private key-pair is
 * used to rotate the `UserKey`.
 *
 * The `PrivateKey` is protected by an `ExternalKey`, such as a `DeviceKey`, or `PrfKey`,
 * and the `PublicKey` is protected by the `UserKey`. This setup allows:
 *
 *   - Access to `UserKey` by knowing the `ExternalKey`
 *   - Rotation to a `NewUserKey` by knowing the current `UserKey`,
 *     without needing access to the `ExternalKey`
 */
export class RotateableKeySet<ExternalKey extends SymmetricCryptoKey = SymmetricCryptoKey> {
  private readonly [tag]: ExternalKey;

  constructor(
    /** PublicKey encrypted UserKey */
    readonly encryptedUserKey: EncString,

    /** UserKey encrypted PublicKey */
    readonly encryptedPublicKey: EncString,

    /** ExternalKey encrypted PrivateKey */
    readonly encryptedPrivateKey?: EncString,
  ) {}
}

export type PrfKeySet = RotateableKeySet<PrfKey>;
