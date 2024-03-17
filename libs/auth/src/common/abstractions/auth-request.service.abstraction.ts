import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { UserKey, MasterKey } from "@bitwarden/common/types/key";

export abstract class AuthRequestServiceAbstraction {
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
   */
  abstract setUserKeyAfterDecryptingSharedUserKey: (
    authReqResponse: AuthRequestResponse,
    authReqPrivateKey: ArrayBuffer,
  ) => Promise<void>;
  /**
   * Sets the `MasterKey` and `MasterKeyHash` from an auth request. Auth request must have a `MasterKey` and `MasterKeyHash`.
   * @param authReqResponse The auth request.
   * @param authReqPrivateKey The private key corresponding to the public key sent in the auth request.
   */
  abstract setKeysAfterDecryptingSharedMasterKeyAndHash: (
    authReqResponse: AuthRequestResponse,
    authReqPrivateKey: ArrayBuffer,
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
}
