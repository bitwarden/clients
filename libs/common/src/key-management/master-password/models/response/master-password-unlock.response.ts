import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { KdfConfigResponse } from "@bitwarden/common/key-management/models/response/kdf-config.response";
import { BaseResponse } from "@bitwarden/common/models/response/base.response";

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

    const masterKeyEncryptedUserKey = this.getResponseProperty("MasterKeyEncryptedUserKey");
    if (masterKeyEncryptedUserKey == null || typeof masterKeyEncryptedUserKey !== "string") {
      throw new Error(
        "MasterPasswordUnlockResponse does not contain a valid master key encrypted user key",
      );
    }
    this.masterKeyWrappedUserKey = new EncString(
      masterKeyEncryptedUserKey,
    ) as MasterKeyWrappedUserKey;
  }

  toMasterPasswordUnlockData() {
    return {
      salt: this.salt,
      kdf: this.kdf.toKdfConfig(),
      masterKeyWrappedUserKey: this.masterKeyWrappedUserKey,
    } as MasterPasswordUnlockData;
  }
}
