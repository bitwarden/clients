// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SendEncryptionType } from "@bitwarden/sdk-internal";

import { SendItemApi } from "../api/send-item.api";

export class SendItemData {
  encryptionVersion: SendEncryptionType;
  data: string;

  constructor(data?: SendItemApi) {
    if (data == null) {
      return;
    }

    this.encryptionVersion = data.encryptionVersion;
    this.data = data.data;
  }
}
