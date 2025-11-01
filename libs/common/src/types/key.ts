import { Opaque } from "type-fest";

import { UnsignedPublicKey } from "../key-management/types";
import { SymmetricCryptoKey } from "../platform/models/domain/symmetric-crypto-key";

// symmetric keys
export type DeviceKey = Opaque<SymmetricCryptoKey, "DeviceKey">;
export type PrfKey = Opaque<SymmetricCryptoKey, "PrfKey">;
export type UserKey = Opaque<SymmetricCryptoKey, "UserKey">;
/** @deprecated Interacting with the master key directly is prohibited. Use a high level function from MasterPasswordService instead. */
export type MasterKey = Opaque<SymmetricCryptoKey, "MasterKey">;
/** @deprecated */
export type PinKey = Opaque<SymmetricCryptoKey, "PinKey">;
export type OrgKey = Opaque<SymmetricCryptoKey, "OrgKey">;
export type ProviderKey = Opaque<SymmetricCryptoKey, "ProviderKey">;
export type CipherKey = Opaque<SymmetricCryptoKey, "CipherKey">;

// asymmetric keys
export type UserPrivateKey = Opaque<Uint8Array, "UserPrivateKey">;
export type UserPublicKey = Opaque<UnsignedPublicKey, "UserPublicKey">;
