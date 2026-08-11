import { Observable } from "rxjs";

import { ProfileOrganizationResponse } from "@bitwarden/common/admin-console/models/response/profile-organization.response";
import { ProfileProviderOrganizationResponse } from "@bitwarden/common/admin-console/models/response/profile-provider-organization.response";
import { ProfileProviderResponse } from "@bitwarden/common/admin-console/models/response/profile-provider.response";
import {
  EncryptedString,
  EncString,
} from "@bitwarden/common/key-management/crypto/models/enc-string";
import { SignedPublicKey, WrappedSigningKey } from "@bitwarden/common/key-management/types";
import { KeySuffixOptions } from "@bitwarden/common/platform/enums";
import { OrganizationId, ProviderId, UserId } from "@bitwarden/common/types/guid";
import {
  UserKey,
  OrgKey,
  ProviderKey,
  UserPrivateKey,
  UserPublicKey,
} from "@bitwarden/common/types/key";

export class UserPrivateKeyDecryptionFailedError extends Error {
  constructor() {
    super("Failed to decrypt the user's private key.");
  }
}

/**
 * An object containing all the users key needed to decrypt a users personal and organization vaults.
 */
export type CipherDecryptionKeys = {
  /**
   * A users {@link UserKey} that is useful for decrypted ciphers in the users personal vault.
   */
  userKey: UserKey;

  /**
   * A users decrypted organization keys.
   */
  orgKeys: Record<OrganizationId, OrgKey> | null;
};

export abstract class KeyService {
  /**
   * Retrieves a stream of the given users {@see UserKey} values. Can emit null if the user does not have a user key, e.g. the user
   * is in a locked or logged out state.
   * @param userId The user id of the user to get the {@see UserKey} for.
   */
  abstract userKey$(userId: UserId): Observable<UserKey | null>;
  /**
   * Returns the an observable key for the given user id.
   *
   * @note this observable represents only user keys stored in memory. A null value does not indicate that we cannot load a user key from storage.
   * @param userId The desired user
   */
  abstract getInMemoryUserKeyFor$(userId: UserId): Observable<UserKey | null>;
  /**
   * Sets the provided user key and stores
   * any other necessary versions (such as auto, biometrics,
   * or pin)
   *
   * @throws Error when key or userId is null. Lock the account to clear a key.
   * @param key The user key to set
   * @param userId The desired user
   */
  abstract setUserKey(key: UserKey, userId: UserId): Promise<void>;
  /**
   * Gets the user key from memory and sets it again,
   * kicking off a refresh of any additional keys
   * (such as auto, biometrics, or pin)
   * @param userId The target user to refresh keys for.
   * @throws Error when userId is null or undefined.
   * @throws When userKey doesn't exist in memory for the target user.
   */
  abstract refreshAdditionalKeys(userId: UserId): Promise<void>;

  /**
   * Observable value that returns whether or not the user has ever had a userKey,
   * i.e. has ever been unlocked/decrypted. This is key for differentiating between TDE locked and standard locked states.
   */
  abstract everHadUserKey$(userId: UserId): Observable<boolean>;

  /**
   * Retrieves the user key
   * @param userId The desired user
   * @returns The user key
   *
   * @deprecated Use {@link userKey$} with a required {@link UserId} instead.
   */
  abstract getUserKey(userId?: string): Promise<UserKey | null>;

  /**
   * Retrieves the user key from storage
   * @param keySuffix The desired version of the user's key to retrieve
   * @param userId The desired user
   * @returns The user key
   * @throws Error when userId is null or undefined.
   */
  abstract getUserKeyFromStorage(
    keySuffix: KeySuffixOptions,
    userId: string,
  ): Promise<UserKey | null>;

  /**
   * Determines whether the user key is available for the given user in memory.
   * @param userId The desired user. If null or undefined, will return false.
   * @returns True if the user key is available, returns false otherwise.
   */
  abstract hasUserKey(userId: UserId): Promise<boolean>;

  /**
   * Clears the user's stored version of the user key
   * @param userId The desired user
   * @throws Error when userId is null or undefined.
   */
  abstract clearStoredUserKey(userId: string): Promise<void>;
  /**
   * Stores the encrypted organization keys and clears any decrypted
   * organization keys currently in memory
   * @param orgs The organizations to set keys for
   * @param providerOrgs The provider organizations to set keys for
   * @param userId The user id of the user to set the org keys for
   */
  abstract setOrgKeys(
    orgs: ProfileOrganizationResponse[],
    providerOrgs: ProfileProviderOrganizationResponse[],
    userId: UserId,
  ): Promise<void>;

  /**
   * Returns the organization's symmetric key
   * @deprecated Use the observable userOrgKeys$ and `map` to the desired {@link OrgKey} instead
   * @throws Error when not active user
   * @param orgId The desired organization
   * @returns The organization's symmetric key
   */
  abstract getOrgKey(orgId: string): Promise<OrgKey | null>;

  /**
   * Stores the provider keys for a given user.
   * @param providers The provider orgs for which to save the keys from.
   * @param userId The user id of the user for which to store the keys for.
   */
  abstract setProviderKeys(providers: ProfileProviderResponse[], userId: UserId): Promise<void>;

  /**
   * Gets an observable of provider keys for the given user.
   * @param userId The user to get provider keys for.
   * @return An observable stream of the users providers keys if they are unlocked, or null if the user is not unlocked.
   * @throws If an invalid user id is passed in.
   */
  abstract providerKeys$(userId: UserId): Observable<Record<ProviderId, ProviderKey> | null>;

  /**
   * Gets an observable stream of the given users decrypted private key, will emit null if the user
   * doesn't have a UserKey to decrypt the encrypted private key or null if the user doesn't have an
   * encrypted private key at all.
   *
   * @param userId The user id of the user to get the data for.
   * @returns An observable stream of the decrypted private key or null if the private key is not present or fails to decrypt
   */
  abstract userPrivateKey$(userId: UserId): Observable<UserPrivateKey | null>;

  /**
   * Gets an observable stream of the given users encrypted private key, will emit null if the user
   * doesn't have an encrypted private key at all.
   *
   * @param userId The user id of the user to get the data for.
   *
   * @deprecated Temporary function to allow the SDK to be initialized after the login process, it
   * will be removed when auth has been migrated to the SDK.
   */
  abstract userEncryptedPrivateKey$(userId: UserId): Observable<EncryptedString | null>;

  /**
   * Gets an observable stream of the given users decrypted private key and public key, guaranteed to be consistent.
   * Will emit null if the user doesn't have a userkey to decrypt the encrypted private key, or null if the user doesn't have a private key
   * at all.
   *
   * @param userId The user id of the user to get the data for.
   */
  abstract userEncryptionKeyPair$(
    userId: UserId,
  ): Observable<{ privateKey: UserPrivateKey; publicKey: UserPublicKey } | null>;

  /**
   * Gets an observable stream of the given users decrypted private key and public key, guaranteed to be consistent.
   * Will emit null if the user doesn't have a userkey to decrypt the encrypted private key, or null if the user doesn't have a private key
   * at all.
   *
   * @param userId The user id of the user to get the data for.
   */
  abstract userEncryptionKeyPair$(
    userId: UserId,
  ): Observable<{ privateKey: UserPrivateKey; publicKey: UserPublicKey } | null>;

  /**
   * Clears all of the user's keys from storage
   * @param userId The user's Id
   * @throws Error when provided userId is null or undefined
   */
  abstract clearKeys(userId: UserId): Promise<void>;

  /**
   * Retrieves all the keys needed for decrypting Ciphers
   * @param userId The user id of the keys to retrieve or null if the user is not Unlocked
   * @param legacySupport `true` if you need to support retrieving the legacy version of the users key, `false` if
   * you do not need legacy support. Use `true` by necessity only. Defaults to `false`. Legacy support is for users
   * that may not have updated to use the new {@link UserKey} yet.
   *
   * @throws If an invalid user id is passed in.
   */
  abstract cipherDecryptionKeys$(
    userId: UserId,
    legacySupport?: boolean,
  ): Observable<CipherDecryptionKeys | null>;

  /**
   * Gets an observable of org keys for the given user.
   * @param userId The user id of the user of which to get the keys for.
   * @return An observable stream of the users organization keys if they are unlocked, or null if the user is not unlocked.
   * The observable will stay alive through locks/unlocks.
   *
   * @throws If an invalid user id is passed in.
   */
  abstract orgKeys$(userId: UserId): Observable<Record<OrganizationId, OrgKey> | null>;

  /**
   * Gets an observable stream of the given users encrypted organisation keys.
   *
   * @param userId The user id of the user to get the data for.
   *
   * @deprecated Temporary function to allow the SDK to be initialized after the login process, it
   * will be removed when auth has been migrated to the SDK.
   */
  abstract encryptedOrgKeys$(userId: UserId): Observable<Record<OrganizationId, EncString>>;

  /**
   * Gets an observable stream of the users public key. If the user is does not have
   * a {@link UserKey} or {@link UserPrivateKey} that is decryptable, this will emit null.
   *
   * @param userId The user id of the user of which to get the public key for.
   *
   * @throws If an invalid user id is passed in.
   */
  abstract userPublicKey$(userId: UserId): Observable<Uint8Array | null>;

  /**
   * Gets a users signing keys from local state.
   * The observable will emit null, exactly if the local state returns null.
   */
  abstract userSigningKey$(userId: UserId): Observable<WrappedSigningKey | null>;

  /**
   * Validates that a userkey is correct for a given user
   * @param key The key to validate
   * @param userId The user id for the key
   */
  abstract validateUserKey(key: UserKey, userId: UserId): Promise<boolean>;

  abstract userSignedPublicKey$(userId: UserId): Observable<SignedPublicKey | null>;
}
