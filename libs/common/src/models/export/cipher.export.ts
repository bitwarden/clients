import { Card } from "@bitwarden/common/vault/models/domain/card";
import { Identity } from "@bitwarden/common/vault/models/domain/identity";
import { Login } from "@bitwarden/common/vault/models/domain/login";
import { SecureNote } from "@bitwarden/common/vault/models/domain/secure-note";
import { SshKey } from "@bitwarden/common/vault/models/domain/ssh-key";
import { CardView } from "@bitwarden/common/vault/models/view/card.view";
import { IdentityView } from "@bitwarden/common/vault/models/view/identity.view";
import { LoginView } from "@bitwarden/common/vault/models/view/login.view";
import { SecureNoteView } from "@bitwarden/common/vault/models/view/secure-note.view";
import { SshKeyView } from "@bitwarden/common/vault/models/view/ssh-key.view";
import { conditionalEncString } from "@bitwarden/common/vault/utils/domain-utils";

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
    req.collectionIds = [];
    req.type = CipherType.Login;
    req.name = "Item name";
    req.notes = "Some notes about this item.";
    req.favorite = false;
    req.fields = [];
    req.reprompt = CipherRepromptType.None;
    req.passwordHistory = [];
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
    view.key = conditionalEncString(req.key);

    if (req.fields != null) {
      view.fields = req.fields.map((f) => FieldExport.toView(f));
    }

    switch (req.type) {
      case CipherType.Login:
        view.login = req.login ? LoginExport.toView(req.login) : new LoginView();
        break;
      case CipherType.SecureNote:
        view.secureNote = req.secureNote
          ? SecureNoteExport.toView(req.secureNote)
          : new SecureNoteView();
        break;
      case CipherType.Card:
        view.card = req.card ? CardExport.toView(req.card) : new CardView();
        break;
      case CipherType.Identity:
        view.identity = req.identity ? IdentityExport.toView(req.identity) : new IdentityView();
        break;
      case CipherType.SshKey:
        view.sshKey = SshKeyExport.toView(req.sshKey) ?? new SshKeyView();
        break;
    }

    if (req.passwordHistory != null) {
      view.passwordHistory = req.passwordHistory.map((ph) => PasswordHistoryExport.toView(ph));
    }

    view.creationDate = req.creationDate ?? view.creationDate;
    view.revisionDate = req.revisionDate ?? view.revisionDate;
    view.deletedDate = req.deletedDate ?? view.deletedDate;
    view.archivedDate = req.archivedDate ?? view.archivedDate;
    return view;
  }

  static toDomain(req: CipherExport, domain = new CipherDomain()) {
    domain.type = req.type;
    domain.folderId = req.folderId;
    if (domain.organizationId == null) {
      domain.organizationId = req.organizationId;
    }
    domain.name = new EncString(req.name);
    domain.notes = conditionalEncString(req.notes);
    domain.favorite = req.favorite;
    domain.reprompt = req.reprompt ?? CipherRepromptType.None;
    domain.key = conditionalEncString(req.key);

    if (req.fields != null) {
      domain.fields = req.fields.map((f) => FieldExport.toDomain(f));
    }

    switch (req.type) {
      case CipherType.Login:
        domain.login = req.login ? LoginExport.toDomain(req.login) : new Login();
        break;
      case CipherType.SecureNote:
        domain.secureNote = req.secureNote
          ? SecureNoteExport.toDomain(req.secureNote)
          : new SecureNote();
        break;
      case CipherType.Card:
        domain.card = req.card ? CardExport.toDomain(req.card) : new Card();
        break;
      case CipherType.Identity:
        domain.identity = req.identity ? IdentityExport.toDomain(req.identity) : new Identity();
        break;
      case CipherType.SshKey:
        domain.sshKey = req.sshKey ? SshKeyExport.toDomain(req.sshKey) : new SshKey();
        break;
    }

    if (req.passwordHistory != null) {
      domain.passwordHistory = req.passwordHistory.map((ph) => PasswordHistoryExport.toDomain(ph));
    }

    domain.creationDate = req.creationDate ?? domain.creationDate;
    domain.revisionDate = req.revisionDate ?? domain.revisionDate;
    domain.deletedDate = req.deletedDate ?? domain.deletedDate;
    domain.archivedDate = req.archivedDate ?? domain.archivedDate;
    return domain;
  }

  type: CipherType = CipherType.Login;
  folderId?: string;
  organizationId?: string;
  collectionIds: string[] = [];
  name: string = "";
  notes?: string;
  favorite: boolean = false;
  fields: FieldExport[] = [];
  login?: LoginExport;
  secureNote?: SecureNoteExport;
  card?: CardExport;
  identity?: IdentityExport;
  sshKey?: SshKeyExport;
  reprompt: CipherRepromptType = CipherRepromptType.None;
  passwordHistory: PasswordHistoryExport[] = [];
  revisionDate: Date = new Date();
  creationDate: Date = new Date();
  deletedDate?: Date;
  archivedDate?: Date;
  key?: string;

  // Use build method instead of ctor so that we can control order of JSON stringify for pretty print
  build(o: CipherView | CipherDomain) {
    this.organizationId = o.organizationId;
    this.folderId = o.folderId;
    this.type = o.type;
    this.reprompt = o.reprompt;

    this.name = safeGetString(o.name) ?? "";
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
    this.archivedDate = o.archivedDate;
  }
}
