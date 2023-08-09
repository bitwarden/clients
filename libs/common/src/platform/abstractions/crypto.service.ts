import { ProfileOrganizationResponse } from "../../admin-console/models/response/profile-organization.response";
import { ProfileProviderOrganizationResponse } from "../../admin-console/models/response/profile-provider-organization.response";
import { ProfileProviderResponse } from "../../admin-console/models/response/profile-provider.response";
import { KdfConfig } from "../../auth/models/domain/kdf-config";
import { KeySuffixOptions, KdfType, HashPurpose } from "../../enums";
import { EncArrayBuffer } from "../models/domain/enc-array-buffer";
import { EncString } from "../models/domain/enc-string";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";

export abstract class CryptoService {
  setKey: (key: SymmetricCryptoKey) => Promise<any>;
  setKeyHash: (keyHash: string) => Promise<void>;
  setEncKey: (encKey: string) => Promise<void>;
  setEncPrivateKey: (encPrivateKey: string) => Promise<void>;
  setOrgKeys: (
    orgs: ProfileOrganizationResponse[],
    providerOrgs: ProfileProviderOrganizationResponse[]
  ) => Promise<void>;
  setProviderKeys: (orgs: ProfileProviderResponse[]) => Promise<void>;
  getKey: (keySuffix?: KeySuffixOptions, userId?: string) => Promise<SymmetricCryptoKey>;
  getKeyFromStorage: (keySuffix: KeySuffixOptions, userId?: string) => Promise<SymmetricCryptoKey>;
  getKeyHash: () => Promise<string>;
  compareAndUpdateKeyHash: (masterPassword: string, key: SymmetricCryptoKey) => Promise<boolean>;
  getEncKey: (key?: SymmetricCryptoKey) => Promise<SymmetricCryptoKey>;
  getPublicKey: () => Promise<Uint8Array>;
  getPrivateKey: () => Promise<Uint8Array>;
  getFingerprint: (fingerprintMaterial: string, publicKey?: Uint8Array) => Promise<string[]>;
  getOrgKeys: () => Promise<Map<string, SymmetricCryptoKey>>;
  getOrgKey: (orgId: string) => Promise<SymmetricCryptoKey>;
  getProviderKey: (providerId: string) => Promise<SymmetricCryptoKey>;
  getKeyForUserEncryption: (key?: SymmetricCryptoKey) => Promise<SymmetricCryptoKey>;
  hasKey: () => Promise<boolean>;
  hasKeyInMemory: (userId?: string) => Promise<boolean>;
  hasKeyStored: (keySuffix?: KeySuffixOptions, userId?: string) => Promise<boolean>;
  hasEncKey: () => Promise<boolean>;
  clearKey: (clearSecretStorage?: boolean, userId?: string) => Promise<any>;
  clearKeyHash: () => Promise<any>;
  clearEncKey: (memoryOnly?: boolean, userId?: string) => Promise<any>;
  clearKeyPair: (memoryOnly?: boolean, userId?: string) => Promise<any>;
  clearOrgKeys: (memoryOnly?: boolean, userId?: string) => Promise<any>;
  clearProviderKeys: (memoryOnly?: boolean) => Promise<any>;
  clearPinProtectedKey: () => Promise<any>;
  clearKeys: (userId?: string) => Promise<any>;
  toggleKey: () => Promise<any>;
  makeKey: (
    password: string,
    salt: string,
    kdf: KdfType,
    kdfConfig: KdfConfig
  ) => Promise<SymmetricCryptoKey>;
  makeKeyFromPin: (
    pin: string,
    salt: string,
    kdf: KdfType,
    kdfConfig: KdfConfig,
    protectedKeyCs?: EncString
  ) => Promise<SymmetricCryptoKey>;
  makeShareKey: () => Promise<[EncString, SymmetricCryptoKey]>;
  makeKeyPair: (key?: SymmetricCryptoKey) => Promise<[string, EncString]>;
  makePinKey: (
    pin: string,
    salt: string,
    kdf: KdfType,
    kdfConfig: KdfConfig
  ) => Promise<SymmetricCryptoKey>;
  makeSendKey: (keyMaterial: Uint8Array) => Promise<SymmetricCryptoKey>;
  hashPassword: (
    password: string,
    key: SymmetricCryptoKey,
    hashPurpose?: HashPurpose
  ) => Promise<string>;
  makeEncKey: (key: SymmetricCryptoKey) => Promise<[SymmetricCryptoKey, EncString]>;
  remakeEncKey: (
    key: SymmetricCryptoKey,
    encKey?: SymmetricCryptoKey
  ) => Promise<[SymmetricCryptoKey, EncString]>;
  encrypt: (plainValue: string | Uint8Array, key?: SymmetricCryptoKey) => Promise<EncString>;
  encryptToBytes: (plainValue: Uint8Array, key?: SymmetricCryptoKey) => Promise<EncArrayBuffer>;
  rsaEncrypt: (data: Uint8Array, publicKey?: Uint8Array) => Promise<EncString>;
  rsaDecrypt: (encValue: string, privateKeyValue?: Uint8Array) => Promise<Uint8Array>;
  decryptToBytes: (encString: EncString, key?: SymmetricCryptoKey) => Promise<Uint8Array>;
  decryptToUtf8: (encString: EncString, key?: SymmetricCryptoKey) => Promise<string>;
  decryptFromBytes: (encBuffer: EncArrayBuffer, key: SymmetricCryptoKey) => Promise<Uint8Array>;
  randomNumber: (min: number, max: number) => Promise<number>;
  validateKey: (key: SymmetricCryptoKey) => Promise<boolean>;
}
