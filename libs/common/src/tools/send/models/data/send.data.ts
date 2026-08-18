// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  AuthType as SdkAuthType,
  Send as SdkSend,
  SendType as SdkSendType,
} from "@bitwarden/sdk-internal";

import { uuidAsString } from "../../../../platform/abstractions/sdk/sdk.service";
import { AuthType } from "../../types/auth-type";
import { SendType } from "../../types/send-type";
import { SendResponse } from "../response/send.response";

import { SendFileData } from "./send-file.data";
import { SendTextData } from "./send-text.data";

const SEND_TYPE_FROM_SDK: Record<SdkSendType, SendType> = {
  [SdkSendType.Text]: SendType.Text,
  [SdkSendType.File]: SendType.File,
  [SdkSendType.Item]: SendType.Item,
};

const AUTH_TYPE_FROM_SDK: Record<SdkAuthType, AuthType> = {
  [SdkAuthType.Email]: AuthType.Email,
  [SdkAuthType.Password]: AuthType.Password,
  [SdkAuthType.None]: AuthType.None,
};

export class SendData {
  id: string;
  accessId: string;
  type: SendType;
  name: string;
  notes: string;
  file: SendFileData;
  text: SendTextData;
  key: string;
  maxAccessCount?: number;
  accessCount: number;
  revisionDate: string;
  expirationDate: string;
  deletionDate: string;
  password: string;
  emails: string;
  disabled: boolean;
  hideEmail: boolean;
  authType: AuthType;

  constructor(response?: SendResponse) {
    if (response == null) {
      return;
    }

    this.id = response.id;
    this.accessId = response.accessId;
    this.type = response.type;
    this.authType = response.authType;
    this.name = response.name;
    this.notes = response.notes;
    this.key = response.key;
    this.maxAccessCount = response.maxAccessCount;
    this.accessCount = response.accessCount;
    this.revisionDate = response.revisionDate;
    this.expirationDate = response.expirationDate;
    this.deletionDate = response.deletionDate;
    this.password = response.password;
    this.emails = response.emails;
    this.disabled = response.disable;
    this.hideEmail = response.hideEmail;
    this.authType = response.authType;

    switch (this.type) {
      case SendType.Text:
        this.text = new SendTextData(response.text);
        break;
      case SendType.File:
        this.file = new SendFileData(response.file);
        break;
      default:
        break;
    }
  }

  /**
   * Builds a `SendData` from the SDK's encrypted `Send`. Mirrors the wire-`SendResponse`
   * constructor above: the encrypted fields (`name`/`notes`/`key`) are already plain strings on
   * the SDK `Send`, dates are ISO strings, and the file/text sub-objects flatten to their
   * `*Data` shapes. Used by the sync notification handler to persist a send the SDK fetched.
   */
  static fromSdkSend(sdkSend: SdkSend): SendData {
    if (sdkSend == null) {
      return null;
    }

    const data = new SendData();
    data.id = sdkSend.id != null ? uuidAsString(sdkSend.id) : null;
    data.accessId = sdkSend.accessId ?? null;
    data.type = SEND_TYPE_FROM_SDK[sdkSend.type];
    data.name = sdkSend.name ?? null;
    data.notes = sdkSend.notes ?? null;
    data.key = sdkSend.key ?? null;
    data.maxAccessCount = sdkSend.maxAccessCount ?? undefined;
    data.accessCount = sdkSend.accessCount;
    data.revisionDate = sdkSend.revisionDate ?? null;
    data.expirationDate = sdkSend.expirationDate ?? null;
    data.deletionDate = sdkSend.deletionDate ?? null;
    data.password = sdkSend.password ?? null;
    data.emails = sdkSend.emails ?? null;
    // The SDK `Send`'s field is `disabled`; `SendResponse`'s wire field is `disable`.
    data.disabled = sdkSend.disabled;
    data.hideEmail = sdkSend.hideEmail;
    data.authType = AUTH_TYPE_FROM_SDK[sdkSend.authType];

    switch (data.type) {
      case SendType.Text:
        if (sdkSend.text != null) {
          const text = new SendTextData();
          text.text = sdkSend.text.text ?? null;
          text.hidden = sdkSend.text.hidden;
          data.text = text;
        }
        break;
      case SendType.File:
        if (sdkSend.file != null) {
          const file = new SendFileData();
          file.id = sdkSend.file.id ?? null;
          file.fileName = sdkSend.file.fileName ?? null;
          file.size = sdkSend.file.size ?? null;
          file.sizeName = sdkSend.file.sizeName ?? null;
          data.file = file;
        }
        break;
      default:
        break;
    }

    return data;
  }
}
