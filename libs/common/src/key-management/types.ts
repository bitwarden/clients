import { Opaque } from "type-fest";

import { EncString, SignedSecurityState as SdkSignedSecurityState } from "@bitwarden/sdk-internal";

/**
 * A private key, encrypted with a symmetric key.
 */
export type WrappedPrivateKey = Opaque<EncString, "WrappedPrivateKey">;

/**
 * A public key, signed with the accounts signature key.
 */
export type SignedPublicKey = Opaque<string, "SignedPublicKey">;
/**
 * A public key in base64 encoded SPKI-DER
 */
export type UnsignedPublicKey = Opaque<Uint8Array, "UnsignedPublicKey">;

/**
 * A signature key encrypted with a symmetric key.
 */
export type WrappedSigningKey = Opaque<EncString, "WrappedSigningKey">;
/**
 * A signature public key (verifying key) in base64 encoded CoseKey format
 */
export type VerifyingKey = Opaque<string, "VerifyingKey">;
/**
 * A signed security state, encoded in base64.
 */
export type SignedSecurityState = Opaque<SdkSignedSecurityState, "SignedSecurityState">;
