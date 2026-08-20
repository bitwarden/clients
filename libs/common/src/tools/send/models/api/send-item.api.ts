// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SendEncryptionType } from "@bitwarden/sdk-internal";

import { BaseResponse } from "../../../../models/response/base.response";

export class SendItemApi extends BaseResponse {
  encryptionVersion: SendEncryptionType;
  data: string;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.encryptionVersion = this.getResponseProperty("EncryptionVersion");
    this.data = this.getResponseProperty("Data");
  }
}
