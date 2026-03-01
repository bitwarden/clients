// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { mock } from "jest-mock-extended";
import { ReplaySubject, Observable } from "rxjs";

// FIXME: Update this file to be type safe and remove this and next line
// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";

import { ForceSetPasswordReason } from "../../../auth/models/domain/force-set-password-reason";
import { UserId } from "../../../types/guid";
import { UserKey } from "../../../types/key";
import { InternalMasterPasswordServiceAbstraction } from "../abstractions/master-password.service.abstraction";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../types/master-password.types";

export class FakeMasterPasswordService implements InternalMasterPasswordServiceAbstraction {
  mock = mock<InternalMasterPasswordServiceAbstraction>();

  // eslint-disable-next-line rxjs/no-exposed-subjects -- test class
  forceSetPasswordReasonSubject = new ReplaySubject<ForceSetPasswordReason>(1);

  constructor() {
  }

  userHasMasterPassword(userId: UserId): Promise<boolean> {
    return this.mock.userHasMasterPassword(userId);
  }

  emailToSalt(email: string): MasterPasswordSalt {
    return this.mock.emailToSalt(email);
  }

  saltForUser$(userId: UserId): Observable<MasterPasswordSalt> {
    return this.mock.saltForUser$(userId);
  }

  forceSetPasswordReason$(userId: UserId): Observable<ForceSetPasswordReason> {
    return this.forceSetPasswordReasonSubject.asObservable();
  }

  setForceSetPasswordReason(reason: ForceSetPasswordReason, userId: UserId): Promise<void> {
    return this.mock.setForceSetPasswordReason(reason, userId);
  }

  makeMasterPasswordAuthenticationData(
    password: string,
    kdf: KdfConfig,
    salt: MasterPasswordSalt,
  ): Promise<MasterPasswordAuthenticationData> {
    return this.mock.makeMasterPasswordAuthenticationData(password, kdf, salt);
  }

  makeMasterPasswordUnlockData(
    password: string,
    kdf: KdfConfig,
    salt: MasterPasswordSalt,
    userKey: UserKey,
  ): Promise<MasterPasswordUnlockData> {
    return this.mock.makeMasterPasswordUnlockData(password, kdf, salt, userKey);
  }

  unwrapUserKeyFromMasterPasswordUnlockData(
    password: string,
    masterPasswordUnlockData: MasterPasswordUnlockData,
  ): Promise<UserKey> {
    return this.mock.unwrapUserKeyFromMasterPasswordUnlockData(password, masterPasswordUnlockData);
  }

  setMasterPasswordUnlockData(
    masterPasswordUnlockData: MasterPasswordUnlockData,
    userId: UserId,
  ): Promise<void> {
    return this.mock.setMasterPasswordUnlockData(masterPasswordUnlockData, userId);
  }

  masterPasswordUnlockData$(userId: UserId): Observable<MasterPasswordUnlockData | null> {
    return this.mock.masterPasswordUnlockData$(userId);
  }
}
