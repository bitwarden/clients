import { Opaque } from "type-fest";

import {
  EncString as SdkEncString,
  SignedPublicKey as SdkSignedPublicKey,
  SignedSecurityState as SdkSignedSecurityState,
} from "@bitwarden/sdk-internal";

import { EncString } from "./crypto/models/enc-string";

/**
 * A private key, encrypted with a symmetric key.
 */
export type WrappedPrivateKey = Opaque<SdkEncString, "WrappedPrivateKey">;

/**
 * A public key, signed with the accounts signature key.
 */
export type SignedPublicKey = Opaque<SdkSignedPublicKey, "SignedPublicKey">;
/**
 * A public key in base64 encoded SPKI-DER
 */
export type UnsignedPublicKey = Opaque<Uint8Array, "UnsignedPublicKey">;

/**
 * A signature key encrypted with a symmetric key.
 */
export type WrappedSigningKey = Opaque<SdkEncString, "WrappedSigningKey">;
/**
 * A signature public key (verifying key) in base64 encoded CoseKey format
 */
export type VerifyingKey = Opaque<string, "VerifyingKey">;
/**
 * A signed security state, encoded in base64.
 */
export type SignedSecurityState = Opaque<SdkSignedSecurityState, "SignedSecurityState">;

/**
 * A local user data key, encrypted with a symmetric key.
 */
export type LocalUserDataKey = Opaque<EncString, "LocalUserDataKey">;
