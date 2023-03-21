import { CaptchaProtectedRequest } from "../../auth/models/request/captcha-protected.request";
import { KdfType } from "../../enums/kdfType";
import { Guid } from "../../types/guid";

import { KeysRequest } from "./keys.request";
import { ReferenceEventRequest } from "./reference-event.request";

export class RegisterRequest implements CaptchaProtectedRequest {
  masterPasswordHint: string;
  keys: KeysRequest;
  token: string;
  organizationUserId: Guid;

  constructor(
    public email: string,
    public name: string,
    public masterPasswordHash: string,
    masterPasswordHint: string,
    public key: string,
    public referenceData: ReferenceEventRequest,
    public captchaResponse: string,
    public kdf: KdfType,
    public kdfIterations: number,
    public kdfMemory?: number,
    public kdfParallelism?: number
  ) {
    this.masterPasswordHint = masterPasswordHint ? masterPasswordHint : null;
  }
}
