// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
// eslint-disable-next-line no-restricted-imports
import { KdfType } from "@bitwarden/legacy-crypto";
import {
  GranteeEmergencyAccess as SdkGranteeEmergencyAccess,
  GrantorEmergencyAccess as SdkGrantorEmergencyAccess,
} from "@bitwarden/sdk-internal";

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

  constructor(partial: Partial<GranteeEmergencyAccess> = {}) {
    Object.assign(this, partial);
  }

  // The SDK enums share the server's numeric values.
  static fromSdk(access: SdkGranteeEmergencyAccess) {
    return new GranteeEmergencyAccess({
      id: uuidAsString(access.id),
      granteeId: access.granteeId == null ? undefined : uuidAsString(access.granteeId),
      name: access.name,
      email: access.email,
      type: access.type as number,
      status: access.status as number,
      waitTimeDays: access.waitTimeDays,
      avatarColor: access.avatarColor,
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

  // The SDK enums share the server's numeric values.
  static fromSdk(access: SdkGrantorEmergencyAccess) {
    return new GrantorEmergencyAccess({
      id: uuidAsString(access.id),
      grantorId: uuidAsString(access.grantorId),
      name: access.name,
      email: access.email,
      type: access.type as number,
      status: access.status as number,
      waitTimeDays: access.waitTimeDays,
      avatarColor: access.avatarColor,
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
