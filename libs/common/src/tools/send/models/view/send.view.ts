// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { SendId as SdkSendId, SendView as SdkSendView } from "@bitwarden/sdk-internal";

import { View } from "../../../../models/view/view";
import { asUuid, uuidAsString } from "../../../../platform/abstractions/sdk/sdk.service";
import { Utils } from "../../../../platform/misc/utils";
import { DeepJsonify } from "../../../../types/deep-jsonify";
import { AuthType } from "../../types/auth-type";
import { SendType } from "../../types/send-type";
import {
  AUTH_TYPE_FROM_SDK,
  AUTH_TYPE_TO_SDK,
  Send,
  SEND_TYPE_FROM_SDK,
  SEND_TYPE_TO_SDK,
} from "../domain/send";

import { SendFileView } from "./send-file.view";
import { SendTextView } from "./send-text.view";

export class SendView implements View {
  id: string = null;
  accessId: string = null;
  name: string = null;
  notes: string = null;
  key: Uint8Array;
  cryptoKey: SymmetricCryptoKey;
  type: SendType = null;
  text = new SendTextView();
  file = new SendFileView();
  maxAccessCount?: number = null;
  accessCount = 0;
  revisionDate: Date = null;
  deletionDate: Date = null;
  expirationDate: Date = null;
  password: string = null;
  emails: string[] = [];
  disabled = false;
  hideEmail = false;
  authType: AuthType = null;

  constructor(s?: Send) {
    if (!s) {
      return;
    }

    this.id = s.id;
    this.accessId = s.accessId;
    this.type = s.type;
    this.authType = s.authType;
    this.maxAccessCount = s.maxAccessCount;
    this.accessCount = s.accessCount;
    this.revisionDate = s.revisionDate;
    this.deletionDate = s.deletionDate;
    this.expirationDate = s.expirationDate;
    this.disabled = s.disabled;
    this.password = s.password;
    this.hideEmail = s.hideEmail;
    this.authType = s.authType;
  }

  get urlB64Key(): string {
    return Utils.fromArrayToUrlB64(this.key);
  }

  get maxAccessCountReached(): boolean {
    if (this.maxAccessCount == null) {
      return false;
    }
    return this.accessCount >= this.maxAccessCount;
  }

  get expired(): boolean {
    if (this.expirationDate == null) {
      return false;
    }
    return this.expirationDate <= new Date();
  }

  get pendingDelete(): boolean {
    return this.deletionDate <= new Date();
  }

  toJSON() {
    return Utils.merge(
      { ...this },
      {
        key: Utils.fromBufferToB64(this.key),
      },
    );
  }

  /**
   * Maps this decrypted `SendView` to the SDK's `SendView` shape, for the key-rotation flow
   * (`SendClient.encrypt_send_for_rotation`). Mirrors `CipherView.toSdkCipherView`: dates become
   * ISO strings and enum-likes are translated via the shared mapping tables.
   *
   * `key` is the URL-safe base64 form of the 16-byte send-key seed — the encoding the SDK's
   * `SendView` expects (it decodes it as `B64Url`). `newPassword` is left `undefined`: it is the
   * SDK's field for a *plaintext* password to (re)derive the send's proof-of-knowledge, which this
   * view does not carry (`this.password` is the already-derived hash), and rotation never changes
   * the send key seed the hash is salted with.
   */
  toSdkSendView(): SdkSendView {
    return {
      id: this.id ? asUuid<SdkSendId>(this.id) : undefined,
      accessId: this.accessId ?? undefined,
      name: this.name ?? "",
      notes: this.notes ?? undefined,
      key: this.key != null ? this.urlB64Key : undefined,
      newPassword: undefined,
      hasPassword: this.password != null,
      type: SEND_TYPE_TO_SDK[this.type],
      file:
        this.type === SendType.File
          ? {
              id: this.file?.id ?? undefined,
              fileName: this.file?.fileName ?? "",
              size: this.file?.size ?? undefined,
              sizeName: this.file?.sizeName ?? undefined,
            }
          : undefined,
      text:
        this.type === SendType.Text
          ? {
              text: this.text?.text ?? undefined,
              hidden: this.text?.hidden ?? false,
            }
          : undefined,
      // Item-type sends are not yet modeled client-side; see PM-41095.
      data: undefined,
      maxAccessCount: this.maxAccessCount ?? undefined,
      accessCount: this.accessCount,
      disabled: this.disabled,
      hideEmail: this.hideEmail,
      revisionDate: this.revisionDate?.toISOString(),
      deletionDate: this.deletionDate?.toISOString(),
      expirationDate: this.expirationDate?.toISOString() ?? undefined,
      emails: this.emails ?? [],
      authType: AUTH_TYPE_TO_SDK[this.authType],
    };
  }

  static fromJSON(json: DeepJsonify<SendView>) {
    if (json == null) {
      return null;
    }

    return Object.assign(new SendView(), json, {
      key: Utils.fromB64ToArray(json.key),
      cryptoKey: SymmetricCryptoKey.fromJSON(json.cryptoKey),
      text: SendTextView.fromJSON(json.text),
      file: SendFileView.fromJSON(json.file),
      revisionDate: json.revisionDate == null ? null : new Date(json.revisionDate),
      deletionDate: json.deletionDate == null ? null : new Date(json.deletionDate),
      expirationDate: json.expirationDate == null ? null : new Date(json.expirationDate),
    });
  }

  /** Maps an SDK `SendView` back to a domain `SendView`. */
  static fromSdkSendView(obj?: SdkSendView): SendView {
    if (obj == null) {
      return null;
    }
    const send = new SendView();
    send.id = obj.id ? uuidAsString(obj.id) : null;
    send.accessId = obj.accessId ?? null;
    send.name = obj.name;
    send.notes = obj.notes;
    send.key = obj.key ? Utils.fromUrlB64ToArray(obj.key) : null;
    send.type = SEND_TYPE_FROM_SDK[obj.type];
    send.maxAccessCount = obj.maxAccessCount ?? undefined;
    send.accessCount = obj.accessCount;
    send.disabled = obj.disabled;
    send.hideEmail = obj.hideEmail;
    send.revisionDate = obj.revisionDate != null ? new Date(obj.revisionDate) : null;
    send.deletionDate = obj.deletionDate != null ? new Date(obj.deletionDate) : null;
    send.expirationDate = obj.expirationDate != null ? new Date(obj.expirationDate) : null;
    // A decrypted SendView from the SDK never has the actual password, only a boolean indicating
    // that the original Send has one. We use that boolean to set the password field to a truthy
    // placeholder value so that callers can use it.
    send.password = obj.hasPassword ? "************" : null;
    send.emails = obj.emails ?? null;
    send.authType = AUTH_TYPE_FROM_SDK[obj.authType];
    send.text = obj.text != null ? SendTextView.fromSdk(obj.text) : null;
    send.file = obj.file != null ? SendFileView.fromSdk(obj.file) : null;
    return send;
  }
}
