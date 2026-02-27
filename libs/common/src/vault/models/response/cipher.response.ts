// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../models/response/base.response";
import { CipherType } from "../../enums";
import { CipherRepromptType } from "../../enums/cipher-reprompt-type";
import { CardApi } from "../api/card.api";
import { CipherPermissionsApi } from "../api/cipher-permissions.api";
import { FieldApi } from "../api/field.api";
import { IdentityApi } from "../api/identity.api";
import { LoginApi } from "../api/login.api";
import { SecureNoteApi } from "../api/secure-note.api";
import { SshKeyApi } from "../api/ssh-key.api";

import { AttachmentResponse } from "./attachment.response";
import { PasswordHistoryResponse } from "./password-history.response";

export type CipherMiniResponse = Omit<
  CipherResponse,
  "edit" | "viewPassword" | "folderId" | "favorite" | "permissions"
>;

export class CipherResponse extends BaseResponse {
  id: string;
  organizationId: string;
  folderId: string;
  type: CipherType;
  name: string;
  notes: string;
  fields: FieldApi[];
  login: LoginApi;
  card: CardApi;
  identity: IdentityApi;
  secureNote: SecureNoteApi;
  sshKey: SshKeyApi;
  favorite: boolean;
  edit: boolean;
  viewPassword: boolean;
  permissions: CipherPermissionsApi;
  organizationUseTotp: boolean;
  revisionDate: string;
  attachments: AttachmentResponse[];
  passwordHistory: PasswordHistoryResponse[];
  collectionIds: string[];
  creationDate: string;
  deletedDate: string;
  archivedDate: string;
  reprompt: CipherRepromptType;
  key: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.organizationId = this.getResponseProperty("OrganizationId");
    this.folderId = this.getResponseProperty("FolderId") || null;
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
    this.permissions = new CipherPermissionsApi(this.getResponseProperty("Permissions"));
    this.organizationUseTotp = this.getResponseProperty("OrganizationUseTotp");
    this.revisionDate = this.getResponseProperty("RevisionDate");
    this.collectionIds = this.getResponseProperty("CollectionIds");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.deletedDate = this.getResponseProperty("DeletedDate");
    this.archivedDate = this.getResponseProperty("ArchivedDate");

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

    const sshKey = this.getResponseProperty("sshKey");
    if (sshKey != null) {
      this.sshKey = new SshKeyApi(sshKey);
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
    this.key = this.getResponseProperty("Key") || null;
  }
}
