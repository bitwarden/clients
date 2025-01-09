// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { AdminAuthRequestStorable } from "@bitwarden/common/auth/models/domain/admin-auth-req-storable";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { AuthRequestPushNotification } from "@bitwarden/common/models/response/notification.response";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey, MasterKey } from "@bitwarden/common/types/key";

export abstract class AuthRequestServiceAbstraction {
  /** Emits an auth request id when an auth request has been approved. */
  authRequestPushNotification$: Observable<string>;

  /**
   * Returns an admin auth request for the given user if it exists.
   * @param userId The user id.
   * @throws If `userId` is not provided.
   */
  abstract getAdminAuthRequest: (userId: UserId) => Promise<AdminAuthRequestStorable | null>;
  /**
   * Sets an admin auth request for the given user.
   * Note: use {@link clearAdminAuthRequest} to clear the request.
   * @param authRequest The admin auth request.
   * @param userId The user id.
   * @throws If `authRequest` or `userId` is not provided.
   */
  abstract setAdminAuthRequest: (
    authRequest: AdminAuthRequestStorable,
    userId: UserId,
  ) => Promise<void>;
  /**
   * Clears an admin auth request for the given user.
   * @param userId The user id.
   * @throws If `userId` is not provided.
   */
  abstract clearAdminAuthRequest: (userId: UserId) => Promise<void>;
  /**
   * Approve or deny an auth request.
   * @param approve True to approve, false to deny.
   * @param authRequest The auth request to approve or deny, must have an id and key.
   * @returns The updated auth request, the `requestApproved` field will be true if
   * approval was successful.
   * @throws If the auth request is missing an id or key.
   */
  abstract approveOrDenyAuthRequest: (
    approve: boolean,
    authRequest: AuthRequestResponse,
  ) => Promise<AuthRequestResponse>;
  /**
   * Sets the `UserKey` from an auth request. Auth request must have a `UserKey`.
   * @param authReqResponse The auth request.
   * @param authReqPrivateKey The private key corresponding to the public key sent in the auth request.
   * @param userId The ID of the user for whose account we will set the key.
   */
  abstract setUserKeyAfterDecryptingSharedUserKey: (
    authReqResponse: AuthRequestResponse,
    authReqPrivateKey: ArrayBuffer,
    userId: UserId,
  ) => Promise<void>;
  /**
   * Sets the `MasterKey` and `MasterKeyHash` from an auth request. Auth request must have a `MasterKey` and `MasterKeyHash`.
   * @param authReqResponse The auth request.
   * @param authReqPrivateKey The private key corresponding to the public key sent in the auth request.
   * @param userId The ID of the user for whose account we will set the keys.
   */
  abstract setKeysAfterDecryptingSharedMasterKeyAndHash: (
    authReqResponse: AuthRequestResponse,
    authReqPrivateKey: ArrayBuffer,
    userId: UserId,
  ) => Promise<void>;
  /**
   * Decrypts a `UserKey` from a public key encrypted `UserKey`.
   * @param pubKeyEncryptedUserKey The public key encrypted `UserKey`.
   * @param privateKey The private key corresponding to the public key used to encrypt the `UserKey`.
   * @returns The decrypted `UserKey`.
   */
  abstract decryptPubKeyEncryptedUserKey: (
    pubKeyEncryptedUserKey: string,
    privateKey: ArrayBuffer,
  ) => Promise<UserKey>;
  /**
   * Decrypts a `MasterKey` and `MasterKeyHash` from a public key encrypted `MasterKey` and `MasterKeyHash`.
   * @param pubKeyEncryptedMasterKey The public key encrypted `MasterKey`.
   * @param pubKeyEncryptedMasterKeyHash The public key encrypted `MasterKeyHash`.
   * @param privateKey The private key corresponding to the public key used to encrypt the `MasterKey` and `MasterKeyHash`.
   * @returns The decrypted `MasterKey` and `MasterKeyHash`.
   */
  abstract decryptPubKeyEncryptedMasterKeyAndHash: (
    pubKeyEncryptedMasterKey: string,
    pubKeyEncryptedMasterKeyHash: string,
    privateKey: ArrayBuffer,
  ) => Promise<{ masterKey: MasterKey; masterKeyHash: string }>;

  /**
   * Handles incoming auth request push notifications.
   * @param notification push notification.
   * @remark We should only be receiving approved push notifications to prevent enumeration.
   */
  abstract sendAuthRequestPushNotification: (notification: AuthRequestPushNotification) => void;

  /**
   * Creates a dash-delimited fingerprint for use in confirming the `AuthRequest` between the requesting and approving device.
   * @param email The email address of the user.
   * @param publicKey The public key for the user.
   * @returns The dash-delimited fingerprint phrase.
   */
  abstract getFingerprintPhrase(email: string, publicKey: Uint8Array): Promise<string>;
}
