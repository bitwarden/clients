import { SendEncryptionType } from "@bitwarden/sdk-internal";

import { BaseResponse } from "../../../../models/response/base.response";

import { SendItemMetadataApi } from "./send-item-metadata.api";

export class SendItemApi extends BaseResponse {
  encryptionVersion: SendEncryptionType;
  /** Opaque sealed cipher blob produced by the SDK; never parsed or re-serialized here. */
  data: string;
  metadata: SendItemMetadataApi;

  constructor(data: any = null) {
    super(data);
    this.encryptionVersion = this.getResponseProperty("EncryptionVersion");
    this.data = this.getResponseProperty("Data");
    this.metadata = new SendItemMetadataApi(this.getResponseProperty("Metadata"));
  }
}
