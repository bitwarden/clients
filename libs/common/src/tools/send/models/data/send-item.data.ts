import { SendEncryptionType } from "@bitwarden/sdk-internal";

import { SendItemApi } from "../api/send-item.api";

import { SendItemMetadataData } from "./send-item-metadata.data";

export class SendItemData {
  encryptionVersion?: SendEncryptionType;
  data?: string;
  metadata?: SendItemMetadataData;

  constructor(data?: SendItemApi) {
    if (data) {
      this.encryptionVersion = data.encryptionVersion;
      this.data = data.data;
      this.metadata = new SendItemMetadataData(data.metadata);
    }
  }
}
