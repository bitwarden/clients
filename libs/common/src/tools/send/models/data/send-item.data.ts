import { SendEncryptionType } from "@bitwarden/sdk-internal";

import { SendItemApi } from "../api/send-item.api";

export class SendItemData {
  encryptionVersion?: SendEncryptionType;
  data?: string;

  constructor(data?: SendItemApi) {
    if (data) {
      this.encryptionVersion = data.encryptionVersion;
      this.data = data.data;
    }
  }
}
