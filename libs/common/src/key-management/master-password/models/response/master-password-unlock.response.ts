import { BaseResponse } from "../../../../models/response/base.response";
import { KdfConfigResponse } from "../../../models/response/kdf-config.response";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "../../types/master-password.types";

export class MasterPasswordUnlockResponse extends BaseResponse {
  salt: MasterPasswordSalt;
  kdf: KdfConfigResponse;
  masterKeyWrappedUserKey: MasterKeyWrappedUserKey;

  constructor(response: unknown) {
    super(response);

    const salt = this.getResponseProperty("Salt");
    if (salt == null || typeof salt !== "string") {
      throw new Error("MasterPasswordUnlockResponse does not contain a valid salt");
    }
    this.salt = salt as MasterPasswordSalt;

    this.kdf = new KdfConfigResponse(this.getResponseProperty("Kdf"));

    // Note: MasterKeyEncryptedUserKey and masterKeyWrappedUserKey are the same thing, and
    // used inconsistently in the codebase
    const masterKeyWrappedUserKey = this.getResponseProperty("MasterKeyEncryptedUserKey");
    if (masterKeyWrappedUserKey == null || typeof masterKeyWrappedUserKey !== "string") {
      throw new Error(
        "MasterPasswordUnlockResponse does not contain a valid master key encrypted user key",
      );
    }
    this.masterKeyWrappedUserKey = masterKeyWrappedUserKey as MasterKeyWrappedUserKey;
  }

  toMasterPasswordUnlockData() {
    return new MasterPasswordUnlockData(
      this.salt,
      this.kdf.toKdfConfig(),
      this.masterKeyWrappedUserKey,
    );
  }
}
