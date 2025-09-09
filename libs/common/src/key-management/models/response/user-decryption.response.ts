import { BaseResponse } from "../../../models/response/base.response";
import { MasterPasswordUnlockResponse } from "../../master-password/models/response/master-password-unlock.response";

export class UserDecryptionResponse extends BaseResponse {
  masterPasswordUnlock?: MasterPasswordUnlockResponse;

  constructor(response: unknown) {
    super(response);

    const masterPasswordUnlock = this.getResponseProperty("MasterPasswordUnlock");
    if (masterPasswordUnlock != null && typeof masterPasswordUnlock === "object") {
      this.masterPasswordUnlock = new MasterPasswordUnlockResponse(masterPasswordUnlock);
    }
  }
}
