// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EncString } from "../../key-management/crypto/models/enc-string";
import { CipherRepromptType } from "../../vault/enums/cipher-reprompt-type";
import { CipherType } from "../../vault/enums/cipher-type";
import { Cipher as CipherDomain } from "../../vault/models/domain/cipher";
import { CipherView } from "../../vault/models/view/cipher.view";

import { CardExport } from "./card.export";
import { FieldExport } from "./field.export";
import { IdentityExport } from "./identity.export";
import { LoginExport } from "./login.export";
import { PasswordHistoryExport } from "./password-history.export";
import { SecureNoteExport } from "./secure-note.export";
import { SshKeyExport } from "./ssh-key.export";
import { safeGetString } from "./utils";

export class CipherExport {
  static template(): CipherExport {
    const req = new CipherExport();
    req.organizationId = null;
    req.collectionIds = null;
    req.folderId = null;
    req.type = CipherType.Login;
    req.name = "Item name";
    req.notes = "Some notes about this item.";
    req.favorite = false;
    req.fields = [];
    req.login = null;
    req.secureNote = null;
    req.card = null;
    req.identity = null;
    req.sshKey = null;
    req.reprompt = CipherRepromptType.None;
    req.passwordHistory = [];
    req.creationDate = null;
    req.revisionDate = null;
    req.deletedDate = null;
    return req;
  }

  static toView(req: CipherExport, view = new CipherView()) {
    view.type = req.type;
    view.folderId = req.folderId;
    if (view.organizationId == null) {
      view.organizationId = req.organizationId;
    }
    if (view.collectionIds || req.collectionIds) {
      const set = new Set((view.collectionIds ?? []).concat(req.collectionIds ?? []));
      view.collectionIds = Array.from(set.values());
    }
    view.name = req.name;
    view.notes = req.notes;
    view.favorite = req.favorite;
    view.reprompt = req.reprompt ?? CipherRepromptType.None;
    view.key = req.key != null ? new EncString(req.key) : null;

    if (req.fields != null) {
      view.fields = req.fields.map((f) => FieldExport.toView(f));
    }

    switch (req.type) {
      case CipherType.Login:
        view.login = LoginExport.toView(req.login);
        break;
      case CipherType.SecureNote:
        view.secureNote = SecureNoteExport.toView(req.secureNote);
        break;
      case CipherType.Card:
        view.card = CardExport.toView(req.card);
        break;
      case CipherType.Identity:
        view.identity = IdentityExport.toView(req.identity);
        break;
      case CipherType.SshKey:
        view.sshKey = SshKeyExport.toView(req.sshKey);
        break;
    }

    if (req.passwordHistory != null) {
      view.passwordHistory = req.passwordHistory.map((ph) => PasswordHistoryExport.toView(ph));
    }

    view.creationDate = req.creationDate ? new Date(req.creationDate) : null;
    view.revisionDate = req.revisionDate ? new Date(req.revisionDate) : null;
    view.deletedDate = req.deletedDate ? new Date(req.deletedDate) : null;
    return view;
  }

  static toDomain(req: CipherExport, domain = new CipherDomain()) {
    domain.type = req.type;
    domain.folderId = req.folderId;
    if (domain.organizationId == null) {
      domain.organizationId = req.organizationId;
    }
    domain.name = req.name != null ? new EncString(req.name) : null;
    domain.notes = req.notes != null ? new EncString(req.notes) : null;
    domain.favorite = req.favorite;
    domain.reprompt = req.reprompt ?? CipherRepromptType.None;
    domain.key = req.key != null ? new EncString(req.key) : null;

    if (req.fields != null) {
      domain.fields = req.fields.map((f) => FieldExport.toDomain(f));
    }

    switch (req.type) {
      case CipherType.Login:
        domain.login = LoginExport.toDomain(req.login);
        break;
      case CipherType.SecureNote:
        domain.secureNote = SecureNoteExport.toDomain(req.secureNote);
        break;
      case CipherType.Card:
        domain.card = CardExport.toDomain(req.card);
        break;
      case CipherType.Identity:
        domain.identity = IdentityExport.toDomain(req.identity);
        break;
      case CipherType.SshKey:
        domain.sshKey = SshKeyExport.toDomain(req.sshKey);
        break;
    }

    if (req.passwordHistory != null) {
      domain.passwordHistory = req.passwordHistory.map((ph) => PasswordHistoryExport.toDomain(ph));
    }

    domain.creationDate = req.creationDate ? new Date(req.creationDate) : null;
    domain.revisionDate = req.revisionDate ? new Date(req.revisionDate) : null;
    domain.deletedDate = req.deletedDate ? new Date(req.deletedDate) : null;
    return domain;
  }

  type: CipherType;
  folderId: string;
  organizationId: string;
  collectionIds: string[];
  name: string;
  notes: string;
  favorite: boolean;
  fields: FieldExport[];
  login: LoginExport;
  secureNote: SecureNoteExport;
  card: CardExport;
  identity: IdentityExport;
  sshKey: SshKeyExport;
  reprompt: CipherRepromptType;
  passwordHistory: PasswordHistoryExport[] = null;
  revisionDate: Date = null;
  creationDate: Date = null;
  deletedDate: Date = null;
  key: string;

  // Use build method instead of ctor so that we can control order of JSON stringify for pretty print
  build(o: CipherView | CipherDomain) {
    this.organizationId = o.organizationId;
    this.folderId = o.folderId;
    this.type = o.type;
    this.reprompt = o.reprompt;

    this.name = safeGetString(o.name);
    this.notes = safeGetString(o.notes);
    if ("key" in o) {
      this.key = o.key?.encryptedString;
    }

    this.favorite = o.favorite;

    if (o.fields != null) {
      this.fields = o.fields.map((f) => new FieldExport(f));
    }

    switch (o.type) {
      case CipherType.Login:
        this.login = new LoginExport(o.login);
        break;
      case CipherType.SecureNote:
        this.secureNote = new SecureNoteExport(o.secureNote);
        break;
      case CipherType.Card:
        this.card = new CardExport(o.card);
        break;
      case CipherType.Identity:
        this.identity = new IdentityExport(o.identity);
        break;
      case CipherType.SshKey:
        this.sshKey = new SshKeyExport(o.sshKey);
        break;
    }

    if (o.passwordHistory != null) {
      this.passwordHistory = o.passwordHistory.map((ph) => new PasswordHistoryExport(ph));
    }

    this.creationDate = o.creationDate;
    this.revisionDate = o.revisionDate;
    this.deletedDate = o.deletedDate;
  }
}
