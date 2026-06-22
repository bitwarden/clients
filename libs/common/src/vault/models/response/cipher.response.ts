// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../models/response/base.response";
import { CipherType } from "../../enums";
import { CipherRepromptType } from "../../enums/cipher-reprompt-type";
import { BankAccountApi } from "../api/bank-account.api";
import { CardApi } from "../api/card.api";
import { CipherPermissionsApi } from "../api/cipher-permissions.api";
import { DriversLicenseApi } from "../api/drivers-license.api";
import { FieldApi } from "../api/field.api";
import { IdentityApi } from "../api/identity.api";
import { LoginApi } from "../api/login.api";
import { PassportApi } from "../api/passport.api";
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
  bankAccount: BankAccountApi;
  driversLicense: DriversLicenseApi;
  passport: PassportApi;
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
  /**
   * Raw JSON-string payload the server returns on PAM-gated rows in lieu of
   * the full sensitive fields. Plumbed through to the SDK Cipher's `data`
   * field so the SDK's decrypt path produces a partial CipherView. Its
   * presence is the "this row is gated" marker used by the vault-row badge
   * and cipher-open gate.
   */
  partialData: string | null = null;

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

    const bankAccount = this.getResponseProperty("BankAccount");
    if (bankAccount != null) {
      this.bankAccount = new BankAccountApi(bankAccount);
    }

    const driversLicense = this.getResponseProperty("DriversLicense");
    if (driversLicense != null) {
      this.driversLicense = new DriversLicenseApi(driversLicense);
    }

    const passport = this.getResponseProperty("Passport");
    if (passport != null) {
      this.passport = new PassportApi(passport);
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

    // PAM gated rows ship a `partialData` JSON blob in place of the sensitive
    // fields. Keep the raw string as the gating marker, and lift the encrypted
    // `Name` from the blob into the top-level `name` so the standard cipher
    // decrypt path (Cipher.decrypt) can decrypt it like any other cipher name.
    const partialData = this.getResponseProperty("PartialData");
    if (partialData != null) {
      this.partialData =
        typeof partialData === "string" ? partialData : JSON.stringify(partialData);
      try {
        const parsed = JSON.parse(this.partialData);
        if (parsed?.Name != null && this.name == null) {
          this.name = parsed.Name;
        }
        // Likewise lift the encrypted login URIs so the partial view exposes a
        // domain (favicon, launch). Only `Uris` ships in the blob — the secret
        // login fields (password, TOTP, …) stay gated — so the decrypted partial
        // view gains a domain but no credentials. Build the login from `Uris`
        // alone so an expanded blob can never leak more onto the gated view.
        if (this.type === CipherType.Login && this.login == null && parsed?.Uris?.length > 0) {
          this.login = new LoginApi({ Uris: parsed.Uris });
        }
      } catch {
        // Malformed partialData blob — leave name as-is. The cipher will
        // render with an empty name; the gating signal (partialData) is
        // still preserved.
      }
    }
  }
}
