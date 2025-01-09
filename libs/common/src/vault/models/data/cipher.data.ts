// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { CipherRepromptType } from "../../enums/cipher-reprompt-type";
import { CipherType } from "../../enums/cipher-type";
import { CipherResponse } from "../response/cipher.response";

import { AttachmentData } from "./attachment.data";
import { CardData } from "./card.data";
import { FieldData } from "./field.data";
import { IdentityData } from "./identity.data";
import { LoginData } from "./login.data";
import { PasswordHistoryData } from "./password-history.data";
import { SecureNoteData } from "./secure-note.data";
import { SshKeyData } from "./ssh-key.data";

export class CipherData {
  id: string;
  organizationId: string;
  folderId: string;
  edit: boolean;
  viewPassword: boolean;
  organizationUseTotp: boolean;
  favorite: boolean;
  revisionDate: string;
  type: CipherType;
  name: string;
  notes: string;
  login?: LoginData;
  secureNote?: SecureNoteData;
  card?: CardData;
  identity?: IdentityData;
  sshKey?: SshKeyData;
  fields?: FieldData[];
  attachments?: AttachmentData[];
  passwordHistory?: PasswordHistoryData[];
  collectionIds?: string[];
  creationDate: string;
  deletedDate: string;
  reprompt: CipherRepromptType;
  key: string;

  constructor(response?: CipherResponse, collectionIds?: string[]) {
    if (response == null) {
      return;
    }

    this.id = response.id;
    this.organizationId = response.organizationId;
    this.folderId = response.folderId;
    this.edit = response.edit;
    this.viewPassword = response.viewPassword;
    this.organizationUseTotp = response.organizationUseTotp;
    this.favorite = response.favorite;
    this.revisionDate = response.revisionDate;
    this.type = response.type;
    this.name = response.name;
    this.notes = response.notes;
    this.collectionIds = collectionIds != null ? collectionIds : response.collectionIds;
    this.creationDate = response.creationDate;
    this.deletedDate = response.deletedDate;
    this.reprompt = response.reprompt;
    this.key = response.key;

    switch (this.type) {
      case CipherType.Login:
        this.login = new LoginData(response.login);
        break;
      case CipherType.SecureNote:
        this.secureNote = new SecureNoteData(response.secureNote);
        break;
      case CipherType.Card:
        this.card = new CardData(response.card);
        break;
      case CipherType.Identity:
        this.identity = new IdentityData(response.identity);
        break;
      case CipherType.SshKey:
        this.sshKey = new SshKeyData(response.sshKey);
        break;
      default:
        break;
    }

    if (response.fields != null) {
      this.fields = response.fields.map((f) => new FieldData(f));
    }
    if (response.attachments != null) {
      this.attachments = response.attachments.map((a) => new AttachmentData(a));
    }
    if (response.passwordHistory != null) {
      this.passwordHistory = response.passwordHistory.map((ph) => new PasswordHistoryData(ph));
    }
  }

  static fromJSON(obj: Jsonify<CipherData>) {
    return Object.assign(new CipherData(), obj);
  }
}
