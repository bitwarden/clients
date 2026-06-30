// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";
import { Jsonify } from "type-fest";

import {
  AuthType as SdkAuthType,
  Send as SdkSend,
  SendId as SdkSendId,
  SendType as SdkSendType,
} from "@bitwarden/sdk-internal";

import { EncString } from "../../../../key-management/crypto/models/enc-string";
import { asUuid, uuidAsString } from "../../../../platform/abstractions/sdk/sdk.service";
import { Utils } from "../../../../platform/misc/utils";
import Domain from "../../../../platform/models/domain/domain-base";
import { UserId } from "../../../../types/guid";
import { AuthType } from "../../types/auth-type";
import { SendType } from "../../types/send-type";
import { SendData } from "../data/send.data";
import { SendView } from "../view/send.view";

import { SendFile } from "./send-file";
import { SendText } from "./send-text";

const SEND_TYPE_TO_SDK: Record<SendType, SdkSendType> = {
  [SendType.Text]: SdkSendType.Text,
  [SendType.File]: SdkSendType.File,
};

const SEND_TYPE_FROM_SDK: Record<SdkSendType, SendType> = {
  [SdkSendType.Text]: SendType.Text,
  [SdkSendType.File]: SendType.File,
};

const AUTH_TYPE_TO_SDK: Record<AuthType, SdkAuthType> = {
  [AuthType.Email]: SdkAuthType.Email,
  [AuthType.Password]: SdkAuthType.Password,
  [AuthType.None]: SdkAuthType.None,
};

const AUTH_TYPE_FROM_SDK: Record<SdkAuthType, AuthType> = {
  [SdkAuthType.Email]: AuthType.Email,
  [SdkAuthType.Password]: AuthType.Password,
  [SdkAuthType.None]: AuthType.None,
};

export class Send extends Domain {
  id: string;
  accessId: string;
  type: SendType;
  name: EncString;
  notes: EncString;
  file: SendFile;
  text: SendText;
  key: EncString;
  maxAccessCount?: number;
  accessCount: number;
  revisionDate: Date;
  expirationDate: Date;
  deletionDate: Date;
  password: string;
  emails: string;
  disabled: boolean;
  hideEmail: boolean;
  authType: AuthType;

  constructor(obj?: SendData) {
    super();
    if (obj == null) {
      return;
    }

    this.buildDomainModel(
      this,
      obj,
      {
        id: null,
        accessId: null,
        name: null,
        notes: null,
        key: null,
      },
      ["id", "accessId"],
    );

    this.type = obj.type;
    this.authType = obj.authType;
    this.maxAccessCount = obj.maxAccessCount;
    this.accessCount = obj.accessCount;
    this.password = obj.password;
    this.disabled = obj.disabled;
    this.revisionDate = obj.revisionDate != null ? new Date(obj.revisionDate) : null;
    this.deletionDate = obj.deletionDate != null ? new Date(obj.deletionDate) : null;
    this.expirationDate = obj.expirationDate != null ? new Date(obj.expirationDate) : null;
    this.hideEmail = obj.hideEmail;
    this.authType = obj.authType;
    this.emails = obj.emails;

    switch (this.type) {
      case SendType.Text:
        this.text = new SendText(obj.text);
        break;
      case SendType.File:
        this.file = new SendFile(obj.file);
        break;
      default:
        break;
    }
  }

  async decrypt(userId: UserId): Promise<SendView> {
    if (!userId) {
      throw new Error("User ID must not be null or undefined");
    }

    const model = new SendView(this);
    const keyService = Utils.getContainerService().getKeyService();
    const encryptService = Utils.getContainerService().getEncryptService();
    const sendKeyEncryptionKey = await firstValueFrom(keyService.userKey$(userId));
    // model.key is a seed used to derive a key, not a SymmetricCryptoKey
    model.key = await encryptService.decryptBytes(this.key, sendKeyEncryptionKey);
    model.cryptoKey = await keyService.makeSendKey(model.key);
    model.name =
      this.name != null ? await encryptService.decryptString(this.name, model.cryptoKey) : null;
    model.notes =
      this.notes != null ? await encryptService.decryptString(this.notes, model.cryptoKey) : null;

    if (this.emails != null) {
      model.emails = this.emails ? this.emails.split(",").map((e) => e.trim()) : [];
    } else {
      model.emails = [];
    }

    switch (this.type) {
      case SendType.File:
        model.file = await this.file.decrypt(model.cryptoKey);
        break;
      case SendType.Text:
        model.text = await this.text.decrypt(model.cryptoKey);
        break;
      default:
        break;
    }

    return model;
  }

  static fromJSON(obj: Jsonify<Send>) {
    if (obj == null) {
      return null;
    }

    const revisionDate = obj.revisionDate == null ? null : new Date(obj.revisionDate);
    const expirationDate = obj.expirationDate == null ? null : new Date(obj.expirationDate);
    const deletionDate = obj.deletionDate == null ? null : new Date(obj.deletionDate);

    return Object.assign(new Send(), obj, {
      key: EncString.fromJSON(obj.key),
      name: EncString.fromJSON(obj.name),
      notes: EncString.fromJSON(obj.notes),
      emails: obj.emails,
      text: SendText.fromJSON(obj.text),
      file: SendFile.fromJSON(obj.file),
      revisionDate,
      expirationDate,
      deletionDate,
    });
  }

  /**
   * Maps this domain `Send` to the SDK `Send` shape. The encrypted fields pass through as
   * `EncString`s (no new crypto); enum-likes and dates are translated to the SDK's wire forms.
   */
  toSdkSend(): SdkSend {
    return {
      id: this.id ? asUuid<SdkSendId>(this.id) : undefined,
      accessId: this.accessId ?? undefined,
      name: this.name?.toSdk(),
      notes: this.notes?.toSdk(),
      key: this.key?.toSdk(),
      password: this.password ?? undefined,
      type: SEND_TYPE_TO_SDK[this.type],
      file: this.file ? this.file.toSdk() : undefined,
      text: this.text ? this.text.toSdk() : undefined,
      maxAccessCount: this.maxAccessCount ?? undefined,
      accessCount: this.accessCount,
      disabled: this.disabled,
      hideEmail: this.hideEmail,
      revisionDate: this.revisionDate?.toISOString(),
      deletionDate: this.deletionDate?.toISOString(),
      expirationDate: this.expirationDate?.toISOString() ?? undefined,
      emails: this.emails ?? undefined,
      authType: AUTH_TYPE_TO_SDK[this.authType],
    };
  }

  /** Maps an SDK `Send` back to a domain `Send`. */
  static fromSdkSend(obj?: SdkSend): Send {
    if (obj == null) {
      return null;
    }

    const send = new Send();
    send.id = obj.id ? uuidAsString(obj.id) : null;
    send.accessId = obj.accessId ?? null;
    send.name = EncString.fromJSON(obj.name);
    send.notes = EncString.fromJSON(obj.notes);
    send.key = EncString.fromJSON(obj.key);
    send.password = obj.password ?? null;
    send.type = SEND_TYPE_FROM_SDK[obj.type];
    send.maxAccessCount = obj.maxAccessCount ?? undefined;
    send.accessCount = obj.accessCount;
    send.disabled = obj.disabled;
    send.hideEmail = obj.hideEmail;
    send.revisionDate = obj.revisionDate != null ? new Date(obj.revisionDate) : null;
    send.deletionDate = obj.deletionDate != null ? new Date(obj.deletionDate) : null;
    send.expirationDate = obj.expirationDate != null ? new Date(obj.expirationDate) : null;
    send.emails = obj.emails ?? null;
    send.authType = AUTH_TYPE_FROM_SDK[obj.authType];
    send.text = obj.text != null ? SendText.fromSdk(obj.text) : null;
    send.file = obj.file != null ? SendFile.fromSdk(obj.file) : null;
    return send;
  }

  /**
   * Serializes this domain `Send` to its `SendData` (string-shaped) form — the representation
   * stored in `SEND_USER_ENCRYPTED` state and consumed by the SDK send repository mapper.
   */
  toSendData(): SendData {
    const data = new SendData();
    data.id = this.id;
    data.accessId = this.accessId;
    data.type = this.type;
    data.name = this.name?.toJSON() ?? null;
    data.notes = this.notes?.toJSON() ?? null;
    data.key = this.key?.toJSON() ?? null;
    data.maxAccessCount = this.maxAccessCount;
    data.accessCount = this.accessCount;
    data.revisionDate = this.revisionDate?.toISOString() ?? null;
    data.expirationDate = this.expirationDate?.toISOString() ?? null;
    data.deletionDate = this.deletionDate?.toISOString() ?? null;
    data.password = this.password;
    data.emails = this.emails;
    data.disabled = this.disabled;
    data.hideEmail = this.hideEmail;
    data.authType = this.authType;

    switch (this.type) {
      case SendType.Text:
        data.text = this.text?.toSendData();
        break;
      case SendType.File:
        data.file = this.file?.toSendData();
        break;
      default:
        break;
    }

    return data;
  }
}
