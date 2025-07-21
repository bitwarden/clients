// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, Subject, defer, firstValueFrom, map } from "rxjs";
import { Jsonify } from "type-fest";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AdminAuthRequestStorable } from "@bitwarden/common/auth/models/domain/admin-auth-req-storable";
import { PasswordlessAuthRequest } from "@bitwarden/common/auth/models/request/passwordless-auth.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { AuthRequestPushNotification } from "@bitwarden/common/models/response/notification.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import {
  AUTH_REQUEST_DISK_LOCAL,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { AuthRequestApiServiceAbstraction } from "../../abstractions/auth-request-api.service";
import { AuthRequestServiceAbstraction } from "../../abstractions/auth-request.service.abstraction";

/**
 * Disk-local to maintain consistency between tabs. We don't want to
 * clear this on logout since admin auth requests are long-lived.
 */
export const ADMIN_AUTH_REQUEST_KEY = new UserKeyDefinition<Jsonify<AdminAuthRequestStorable>>(
  AUTH_REQUEST_DISK_LOCAL,
  "adminAuthRequest",
  {
    deserializer: (value) => value,
    clearOn: [],
  },
);

export class AuthRequestService implements AuthRequestServiceAbstraction {
  private authRequestPushNotificationSubject = new Subject<string>();
  authRequestPushNotification$: Observable<string>;

  // Observable emission is used to trigger a toast in consuming components
  private adminLoginApprovedSubject = new Subject<void>();
  adminLoginApproved$: Observable<void>;

  constructor(
    private appIdService: AppIdService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private keyService: KeyService,
    private encryptService: EncryptService,
    private apiService: ApiService,
    private stateProvider: StateProvider,
    private authRequestApiService: AuthRequestApiServiceAbstraction,
  ) {
    this.authRequestPushNotification$ = this.authRequestPushNotificationSubject.asObservable();
    this.adminLoginApproved$ = this.adminLoginApprovedSubject.asObservable();
  }

  async getAdminAuthRequest(userId: UserId): Promise<AdminAuthRequestStorable | null> {
    if (userId == null) {
      throw new Error("User ID is required");
    }

    const authRequestSerialized = await firstValueFrom(
      this.stateProvider.getUser(userId, ADMIN_AUTH_REQUEST_KEY).state$,
    );
    const adminAuthRequestStorable = AdminAuthRequestStorable.fromJSON(authRequestSerialized);
    return adminAuthRequestStorable;
  }

  async setAdminAuthRequest(authRequest: AdminAuthRequestStorable, userId: UserId): Promise<void> {
    if (userId == null) {
      throw new Error("User ID is required");
    }
    if (authRequest == null) {
      throw new Error("Auth request is required");
    }

    await this.stateProvider.setUserState(ADMIN_AUTH_REQUEST_KEY, authRequest.toJSON(), userId);
  }

  async clearAdminAuthRequest(userId: UserId): Promise<void> {
    if (userId == null) {
      throw new Error("User ID is required");
    }

    await this.stateProvider.setUserState(ADMIN_AUTH_REQUEST_KEY, null, userId);
  }

  /**
   * @description Gets the list of all standard (not admin approval) pending AuthRequests.
   */
  getPendingAuthRequests$(): Observable<Array<AuthRequestResponse>> {
    return defer(() => this.authRequestApiService.getPendingAuthRequests()).pipe(
      map((authRequestResponses: ListResponse<AuthRequestResponse>) => {
        return authRequestResponses.data.map((authRequestResponse: AuthRequestResponse) => {
          return new AuthRequestResponse(authRequestResponse);
        });
      }),
    );
  }

  getLatestPendingAuthRequest$(): Observable<AuthRequestResponse | null> {
    return this.getPendingAuthRequests$().pipe(
      map((authRequests: Array<AuthRequestResponse>) => {
        if (authRequests.length === 0) {
          return null;
        }
        return authRequests.sort((a, b) => {
          const dateA = new Date(a.creationDate).getTime();
          const dateB = new Date(b.creationDate).getTime();
          return dateB - dateA; // Sort in descending order
        })[0];
      }),
    );
  }

  async approveOrDenyAuthRequest(
    approve: boolean,
    authRequest: AuthRequestResponse,
  ): Promise<AuthRequestResponse> {
    if (!authRequest.id) {
      throw new Error("Auth request has no id");
    }
    if (!authRequest.publicKey) {
      throw new Error("Auth request has no public key");
    }
    const pubKey = Utils.fromB64ToArray(authRequest.publicKey);

    const keyToEncrypt = await this.keyService.getUserKey();
    const encryptedKey = await this.encryptService.encapsulateKeyUnsigned(keyToEncrypt, pubKey);

    const response = new PasswordlessAuthRequest(
      encryptedKey.encryptedString,
      undefined,
      await this.appIdService.getAppId(),
      approve,
    );
    return await this.apiService.putAuthRequest(authRequest.id, response);
  }

  async setUserKeyAfterDecryptingSharedUserKey(
    authReqResponse: AuthRequestResponse,
    authReqPrivateKey: Uint8Array,
    userId: UserId,
  ) {
    const userKey = await this.decryptPubKeyEncryptedUserKey(
      authReqResponse.key,
      authReqPrivateKey,
    );
    await this.keyService.setUserKey(userKey, userId);
  }

  async setKeysAfterDecryptingSharedMasterKeyAndHash(
    authReqResponse: AuthRequestResponse,
    authReqPrivateKey: Uint8Array,
    userId: UserId,
  ) {
    const { masterKey, masterKeyHash } = await this.decryptPubKeyEncryptedMasterKeyAndHash(
      authReqResponse.key,
      authReqResponse.masterPasswordHash,
      authReqPrivateKey,
    );

    // Decrypt and set user key in state
    const userKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(masterKey, userId);

    // Set masterKey + masterKeyHash in state after decryption (in case decryption fails)
    await this.masterPasswordService.setMasterKey(masterKey, userId);
    await this.masterPasswordService.setMasterKeyHash(masterKeyHash, userId);

    await this.keyService.setUserKey(userKey, userId);
  }

  // Decryption helpers
  async decryptPubKeyEncryptedUserKey(
    pubKeyEncryptedUserKey: string,
    privateKey: Uint8Array,
  ): Promise<UserKey> {
    const decryptedUserKey = await this.encryptService.decapsulateKeyUnsigned(
      new EncString(pubKeyEncryptedUserKey),
      privateKey,
    );

    return decryptedUserKey as UserKey;
  }

  async decryptPubKeyEncryptedMasterKeyAndHash(
    pubKeyEncryptedMasterKey: string,
    pubKeyEncryptedMasterKeyHash: string,
    privateKey: Uint8Array,
  ): Promise<{ masterKey: MasterKey; masterKeyHash: string }> {
    const decryptedMasterKeyArrayBuffer = await this.encryptService.rsaDecrypt(
      new EncString(pubKeyEncryptedMasterKey),
      privateKey,
    );

    const decryptedMasterKeyHashArrayBuffer = await this.encryptService.rsaDecrypt(
      new EncString(pubKeyEncryptedMasterKeyHash),
      privateKey,
    );

    const masterKey = new SymmetricCryptoKey(decryptedMasterKeyArrayBuffer) as MasterKey;
    const masterKeyHash = Utils.fromBufferToUtf8(decryptedMasterKeyHashArrayBuffer);

    return {
      masterKey,
      masterKeyHash,
    };
  }

  sendAuthRequestPushNotification(notification: AuthRequestPushNotification): void {
    if (notification.id != null) {
      this.authRequestPushNotificationSubject.next(notification.id);
    }
  }

  async getFingerprintPhrase(email: string, publicKey: Uint8Array): Promise<string> {
    return (await this.keyService.getFingerprint(email.toLowerCase(), publicKey)).join("-");
  }

  emitAdminLoginApproved(): void {
    this.adminLoginApprovedSubject.next();
  }
}
