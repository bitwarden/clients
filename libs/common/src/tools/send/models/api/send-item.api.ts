import { SendEncryptionType } from "@bitwarden/sdk-internal";

import { BaseResponse } from "../../../../models/response/base.response";

import { SendItemMetadataApi } from "./send-item-metadata.api";

export class SendItemApi extends BaseResponse {
  encryptionVersion: SendEncryptionType;
  data: string;
  metadata?: SendItemMetadataApi;

  constructor(data: any = null) {
    super(data);
    this.encryptionVersion = this.getResponseProperty("EncryptionVersion");
    this.data = this.getResponseProperty("Data");

    const metadata = this.getResponseProperty("Metadata");
    if (metadata != null) {
      this.metadata = new SendItemMetadataApi(metadata);
    }
  }
}
