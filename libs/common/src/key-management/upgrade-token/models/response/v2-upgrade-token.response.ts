import { EncString, V2UpgradeToken } from "@bitwarden/sdk-internal";

import { BaseResponse } from "../../../../models/response/base.response";

export class V2UpgradeTokenResponse extends BaseResponse {
  wrappedUserKey1: EncString;
  wrappedUserKey2: EncString;

  constructor(response: unknown) {
    super(response);

    const wrappedUserKey1 = this.getResponseProperty("WrappedUserKey1");
    if (wrappedUserKey1 == null || typeof wrappedUserKey1 !== "string") {
      throw new Error("V2UpgradeTokenResponse does not contain a valid wrappedUserKey1");
    }
    this.wrappedUserKey1 = wrappedUserKey1 as EncString;

    const wrappedUserKey2 = this.getResponseProperty("WrappedUserKey2");
    if (wrappedUserKey2 == null || typeof wrappedUserKey2 !== "string") {
      throw new Error("V2UpgradeTokenResponse does not contain a valid wrappedUserKey2");
    }
    this.wrappedUserKey2 = wrappedUserKey2 as EncString;
  }

  toV2UpgradeToken(): V2UpgradeToken {
    return {
      wrapped_user_key_1: this.wrappedUserKey1,
      wrapped_user_key_2: this.wrappedUserKey2,
    };
  }
}
