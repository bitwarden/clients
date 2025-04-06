// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { KdfType } from "@bitwarden/key-management";

import { KeysRequest } from "./keys.request";
import { ReferenceEventRequest } from "./reference-event.request";

export class RegisterRequest {
  masterPasswordHint: string;
  keys: KeysRequest;
  token: string;
  organizationUserId: string;

  constructor(
    public email: string,
    public name: string,
    public masterPasswordHash: string,
    masterPasswordHint: string,
    public key: string,
    public referenceData: ReferenceEventRequest,
    public kdf: KdfType,
    public kdfIterations: number,
    public kdfMemory?: number,
    public kdfParallelism?: number,
  ) {
    this.masterPasswordHint = masterPasswordHint ? masterPasswordHint : null;
  }
}
