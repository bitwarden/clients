import { Jsonify } from "type-fest";

import { CipherRepromptType } from "../../enums/cipher-reprompt-type";
import { CipherType } from "../../enums/cipher-type";
import { CipherPermissionsApi } from "../api/cipher-permissions.api";
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
  id: string = "";
  organizationId?: string;
  folderId?: string;
  edit: boolean = false;
  viewPassword: boolean = true;
  permissions?: CipherPermissionsApi;
  organizationUseTotp: boolean = false;
  favorite: boolean = false;
  revisionDate: string;
  type: CipherType = CipherType.Login;
  name: string = "";
  notes?: string;
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
  deletedDate?: string;
  archivedDate?: string;
  reprompt: CipherRepromptType = CipherRepromptType.None;
  key?: string;

  constructor(response?: CipherResponse, collectionIds?: string[]) {
    if (response == null) {
      this.creationDate = this.revisionDate = new Date().toISOString();
      return;
    }

    this.id = response.id;
    this.organizationId = response.organizationId;
    this.folderId = response.folderId;
    this.edit = response.edit;
    this.viewPassword = response.viewPassword;
    this.permissions = response.permissions;
    this.organizationUseTotp = response.organizationUseTotp;
    this.favorite = response.favorite;
    this.revisionDate = response.revisionDate;
    this.type = response.type as CipherType;
    this.name = response.name;
    this.notes = response.notes;
    this.collectionIds = collectionIds != null ? collectionIds : response.collectionIds;
    this.creationDate = response.creationDate;
    this.deletedDate = response.deletedDate;
    this.archivedDate = response.archivedDate;
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
    const result = Object.assign(new CipherData(), obj);
    if (obj.permissions != null) {
      result.permissions = CipherPermissionsApi.fromJSON(obj.permissions);
    }
    return result;
  }
}
