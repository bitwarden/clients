// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { KdfType } from "../../../../../../../libs/key-management/src/enums/kdf-type.enum";

export class MasterPasswordUnlockDataRequest {
  kdfType: KdfType;
  kdfIterations: number;
  kdfMemory?: number;
  kdfParallelism?: number;

  email: string;
  masterPasswordHash: string;

  masterKeyEncryptedUserKey: string;
}
