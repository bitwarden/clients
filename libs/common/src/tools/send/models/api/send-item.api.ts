import { SendEncryptionType } from "@bitwarden/sdk-internal";

import { BaseResponse } from "../../../../models/response/base.response";

export class SendItemApi extends BaseResponse {
  encryptionVersion: SendEncryptionType;
  data: string;

  constructor(data: any = null) {
    super(data);
    this.encryptionVersion = this.getResponseProperty("EncryptionVersion");
    this.data = this.getResponseProperty("Data");
  }
}
