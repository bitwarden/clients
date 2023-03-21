import { CardApi } from "../../../models/api/card.api";
import { FieldApi } from "../../../models/api/field.api";
import { IdentityApi } from "../../../models/api/identity.api";
import { LoginApi } from "../../../models/api/login.api";
import { SecureNoteApi } from "../../../models/api/secure-note.api";
import { BaseResponse } from "../../../models/response/base.response";
import { Guid } from "../../../types/guid";
import { CipherRepromptType } from "../../enums/cipher-reprompt-type";

import { AttachmentResponse } from "./attachment.response";
import { PasswordHistoryResponse } from "./password-history.response";

export class CipherResponse extends BaseResponse {
  id: Guid;
  organizationId: Guid;
  folderId: Guid;
  type: number;
  name: string;
  notes: string;
  fields: FieldApi[];
  login: LoginApi;
  card: CardApi;
  identity: IdentityApi;
  secureNote: SecureNoteApi;
  favorite: boolean;
  edit: boolean;
  viewPassword: boolean;
  organizationUseTotp: boolean;
  revisionDate: string;
  attachments: AttachmentResponse[];
  passwordHistory: PasswordHistoryResponse[];
  collectionIds: Guid[];
  creationDate: string;
  deletedDate: string;
  reprompt: CipherRepromptType;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.organizationId = this.getResponseProperty<Guid>("OrganizationId");
    this.folderId = this.getResponseProperty<Guid>("FolderId") || null;
    this.type = this.getResponseProperty("Type");
    this.name = this.getResponseProperty("Name");
    this.notes = this.getResponseProperty("Notes");
    this.favorite = this.getResponseProperty("Favorite") || false;
    this.edit = !!this.getResponseProperty("Edit");
    if (this.getResponseProperty("ViewPassword") == null) {
      this.viewPassword = true;
    } else {
      this.viewPassword = this.getResponseProperty("ViewPassword");
    }
    this.organizationUseTotp = this.getResponseProperty("OrganizationUseTotp");
    this.revisionDate = this.getResponseProperty("RevisionDate");
    this.collectionIds = this.getResponseProperty<Guid[]>("CollectionIds");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.deletedDate = this.getResponseProperty("DeletedDate");

    const login = this.getResponseProperty("Login");
    if (login != null) {
      this.login = new LoginApi(login);
    }

    const card = this.getResponseProperty("Card");
    if (card != null) {
      this.card = new CardApi(card);
    }

    const identity = this.getResponseProperty("Identity");
    if (identity != null) {
      this.identity = new IdentityApi(identity);
    }

    const secureNote = this.getResponseProperty("SecureNote");
    if (secureNote != null) {
      this.secureNote = new SecureNoteApi(secureNote);
    }

    const fields = this.getResponseProperty("Fields");
    if (fields != null) {
      this.fields = fields.map((f: any) => new FieldApi(f));
    }

    const attachments = this.getResponseProperty("Attachments");
    if (attachments != null) {
      this.attachments = attachments.map((a: any) => new AttachmentResponse(a));
    }

    const passwordHistory = this.getResponseProperty("PasswordHistory");
    if (passwordHistory != null) {
      this.passwordHistory = passwordHistory.map((h: any) => new PasswordHistoryResponse(h));
    }

    this.reprompt = this.getResponseProperty("Reprompt") || CipherRepromptType.None;
  }
}
