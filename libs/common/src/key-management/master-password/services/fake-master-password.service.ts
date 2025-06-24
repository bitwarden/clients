// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock } from "jest-mock-extended";
import { ReplaySubject, Observable } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";

import { ForceSetPasswordReason } from "../../../auth/models/domain/force-set-password-reason";
import { HashPurpose } from "../../../platform/enums";
import { EncString } from "../../../platform/models/domain/enc-string";
import { UserId } from "../../../types/guid";
import { MasterKey, UserKey } from "../../../types/key";
import { InternalMasterPasswordServiceAbstraction } from "../abstractions/master-password.service.abstraction";

export class FakeMasterPasswordService implements InternalMasterPasswordServiceAbstraction {
  mock = mock<InternalMasterPasswordServiceAbstraction>();

  // eslint-disable-next-line rxjs/no-exposed-subjects -- test class
  masterKeySubject = new ReplaySubject<MasterKey | null>(1);
  // eslint-disable-next-line rxjs/no-exposed-subjects -- test class
  masterKeyHashSubject = new ReplaySubject<string | null>(1);
  // eslint-disable-next-line rxjs/no-exposed-subjects -- test class
  forceSetPasswordReasonSubject = new ReplaySubject<ForceSetPasswordReason>(1);

  constructor(initialMasterKey?: MasterKey, initialMasterKeyHash?: string) {
    this.masterKeySubject.next(initialMasterKey);
    this.masterKeyHashSubject.next(initialMasterKeyHash);
  }

  masterKey$(userId: UserId): Observable<MasterKey> {
    return this.masterKeySubject.asObservable();
  }

  setMasterKey(masterKey: MasterKey, userId: UserId): Promise<void> {
    return this.mock.setMasterKey(masterKey, userId);
  }

  clearMasterKey(userId: UserId): Promise<void> {
    return this.mock.clearMasterKey(userId);
  }

  masterKeyHash$(userId: UserId): Observable<string> {
    return this.masterKeyHashSubject.asObservable();
  }

  getMasterKeyEncryptedUserKey(userId: UserId): Promise<EncString> {
    return this.mock.getMasterKeyEncryptedUserKey(userId);
  }

  setMasterKeyEncryptedUserKey(encryptedKey: EncString, userId: UserId): Promise<void> {
    return this.mock.setMasterKeyEncryptedUserKey(encryptedKey, userId);
  }

  setMasterKeyHash(masterKeyHash: string, userId: UserId): Promise<void> {
    return this.mock.setMasterKeyHash(masterKeyHash, userId);
  }

  clearMasterKeyHash(userId: UserId): Promise<void> {
    return this.mock.clearMasterKeyHash(userId);
  }

  forceSetPasswordReason$(userId: UserId): Observable<ForceSetPasswordReason> {
    return this.forceSetPasswordReasonSubject.asObservable();
  }

  setForceSetPasswordReason(reason: ForceSetPasswordReason, userId: UserId): Promise<void> {
    return this.mock.setForceSetPasswordReason(reason, userId);
  }

  decryptUserKeyWithMasterKey(
    masterKey: MasterKey,
    userId: string,
    userKey?: EncString,
  ): Promise<UserKey> {
    return this.mock.decryptUserKeyWithMasterKey(masterKey, userId, userKey);
  }

  getOrDeriveMasterKey(password: string, userId: UserId): Promise<MasterKey> {
    return this.mock.getOrDeriveMasterKey(password, userId);
  }
  makeMasterKey(password: string, email: string, KdfConfig: KdfConfig): Promise<MasterKey> {
    return this.mock.makeMasterKey(password, email, KdfConfig);
  }
  hashMasterKey(password: string, key: MasterKey, hashPurpose?: HashPurpose): Promise<string> {
    return this.mock.hashMasterKey(password, key, hashPurpose);
  }
  compareKeyHash(masterPassword: string, masterKey: MasterKey, userId: UserId): Promise<boolean> {
    return this.mock.compareKeyHash(masterPassword, masterKey, userId);
  }
}
