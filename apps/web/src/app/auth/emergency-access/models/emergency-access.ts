// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { KdfType } from "@bitwarden/key-management";

import { EmergencyAccessStatusType } from "../enums/emergency-access-status-type";
import { EmergencyAccessType } from "../enums/emergency-access-type";
import {
  EmergencyAccessGranteeDetailsResponse,
  EmergencyAccessGrantorDetailsResponse,
} from "../response/emergency-access.response";

export class GranteeEmergencyAccess {
  id: string;
  granteeId: string;
  name: string;
  email: string;
  type: EmergencyAccessType;
  status: EmergencyAccessStatusType;
  waitTimeDays: number;
  creationDate: string;
  avatarColor: string;

  constructor(partial: Partial<GranteeEmergencyAccess> = {}) {
    Object.assign(this, partial);
  }

  static fromResponse(response: EmergencyAccessGranteeDetailsResponse) {
    return new GranteeEmergencyAccess({
      id: response.id,
      granteeId: response.granteeId,
      name: response.name,
      email: response.email,
      type: response.type,
      status: response.status,
      waitTimeDays: response.waitTimeDays,
      creationDate: response.creationDate,
      avatarColor: response.avatarColor,
    });
  }
}

export class GrantorEmergencyAccess {
  id: string;
  grantorId: string;
  name: string;
  email: string;
  type: EmergencyAccessType;
  status: EmergencyAccessStatusType;
  waitTimeDays: number;
  creationDate: string;
  avatarColor: string;

  constructor(partial: Partial<GrantorEmergencyAccess> = {}) {
    Object.assign(this, partial);
  }

  static fromResponse(response: EmergencyAccessGrantorDetailsResponse) {
    return new GrantorEmergencyAccess({
      id: response.id,
      grantorId: response.grantorId,
      name: response.name,
      email: response.email,
      type: response.type,
      status: response.status,
      waitTimeDays: response.waitTimeDays,
      creationDate: response.creationDate,
      avatarColor: response.avatarColor,
    });
  }
}

export class TakeoverTypeEmergencyAccess {
  keyEncrypted: string;
  kdf: KdfType;
  kdfIterations: number;
  kdfMemory?: number;
  kdfParallelism?: number;
}

export class ViewTypeEmergencyAccess {
  keyEncrypted: string;
  ciphers: CipherResponse[] = [];
}

export class GranteeEmergencyAccessWithPublicKey extends GranteeEmergencyAccess {
  publicKey: Uint8Array;
}
