// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KdfType } from "@bitwarden/key-management";

import { PasswordRequest } from "../../auth/models/request/password.request";

export class KdfRequest extends PasswordRequest {
  kdf: KdfType;
  kdfIterations: number;
  kdfMemory?: number;
  kdfParallelism?: number;
}
