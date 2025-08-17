import { MasterPasswordUnlockResponse } from "@bitwarden/common/key-management/master-password/models/response/master-password-unlock.response";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class UserDecryptionResponse extends BaseResponse {
  masterPasswordUnlock?: MasterPasswordUnlockResponse;

  constructor(response: unknown) {
    super(response);

    const masterPasswordUnlock = this.getResponseProperty("MasterPasswordUnlock");
    if (masterPasswordUnlock != null || typeof masterPasswordUnlock === "object") {
      this.masterPasswordUnlock = new MasterPasswordUnlockResponse(masterPasswordUnlock);
    }
  }
}
