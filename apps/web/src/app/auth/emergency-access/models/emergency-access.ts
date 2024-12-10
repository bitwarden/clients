// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { KdfType } from "@bitwarden/key-management";

import { EmergencyAccessStatusType } from "../enums/emergency-access-status-type";
import { EmergencyAccessType } from "../enums/emergency-access-type";

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
