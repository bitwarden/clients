import { Opaque } from "type-fest";

// Keeper's access layer moves a lot of raw bytes around: symmetric keys, nonces, salts and
// asymmetric key material are all Uint8Arrays. These opaque types tag those bytes so the compiler
// rejects passing, say, a salt where a key is expected, or a nonce where ciphertext is expected.
// They carry no runtime cost — they are still plain Uint8Arrays at runtime.

/**
 * Raw AES symmetric key material (32 bytes). Keeper uses the same key bytes for both AES-CBC
 * ("aes-v1") and AES-GCM ("aes-v2") operations, so a single key type covers both algorithms.
 */
export type KeeperKey = Opaque<Uint8Array, "KeeperKey">;

/**
 * AES-GCM nonce, also used as the AES-CBC IV.
 * WARNING: never reuse a nonce with the same key — for AES-GCM this is a catastrophic
 * cryptographic failure.
 */
export type KeeperNonce = Opaque<Uint8Array, "KeeperNonce">;

/** PBKDF2 salt used when deriving a key from the account password. */
export type KeeperSalt = Opaque<Uint8Array, "KeeperSalt">;

/** DER-encoded RSA private key bytes (used with PKCS#1 v1.5 padding). */
export type RsaPrivateKey = Opaque<Uint8Array, "RsaPrivateKey">;

/** DER-encoded RSA public key bytes (used with PKCS#1 v1.5 padding). */
export type RsaPublicKey = Opaque<Uint8Array, "RsaPublicKey">;
