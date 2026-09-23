import { Opaque } from "type-fest";

// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey, UnsignedPublicKey } from "@bitwarden/legacy-crypto";

// symmetric keys
export type DeviceKey = Opaque<SymmetricCryptoKey, "DeviceKey">;
export type PrfKey = Opaque<SymmetricCryptoKey, "PrfKey">;
export type UserKey = Opaque<SymmetricCryptoKey, "UserKey">;
/** @deprecated Interacting with the master key directly is prohibited. Use a high level function from MasterPasswordService instead. */
export type MasterKey = Opaque<SymmetricCryptoKey, "MasterKey">;
export type OrgKey = Opaque<SymmetricCryptoKey, "OrgKey">;
export type ProviderKey = Opaque<SymmetricCryptoKey, "ProviderKey">;

// asymmetric keys
export type UserPrivateKey = Opaque<Uint8Array, "UserPrivateKey">;
export type UserPublicKey = Opaque<UnsignedPublicKey, "UserPublicKey">;
