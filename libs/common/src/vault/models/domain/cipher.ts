// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { asUuid, uuidToString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import {
  Cipher as SdkCipher,
  FolderId as SdkFolderId,
  OrganizationId as SdkOrganizationId,
  CipherId as SdkCipherId,
  CollectionId as SdkCollectionId,
} from "@bitwarden/sdk-internal";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import { Decryptable } from "../../../platform/interfaces/decryptable.interface";
import { Utils } from "../../../platform/misc/utils";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { InitializerKey } from "../../../platform/services/cryptography/initializer-key";
import { CipherRepromptType } from "../../enums/cipher-reprompt-type";
import { CipherType } from "../../enums/cipher-type";
import { CipherPermissionsApi } from "../api/cipher-permissions.api";
import { CipherData } from "../data/cipher.data";
import { LocalData, fromSdkLocalData, toSdkLocalData } from "../data/local.data";
import { AttachmentView } from "../view/attachment.view";
import { CipherView } from "../view/cipher.view";
import { FieldView } from "../view/field.view";
import { PasswordHistoryView } from "../view/password-history.view";

import { Attachment } from "./attachment";
import { Card } from "./card";
import { Field } from "./field";
import { Identity } from "./identity";
import { Login } from "./login";
import { Password } from "./password";
import { SecureNote } from "./secure-note";
import { SshKey } from "./ssh-key";

export class Cipher extends Domain implements Decryptable<CipherView> {
  readonly initializerKey = InitializerKey.Cipher;

  id: string;
  organizationId: string;
  folderId: string;
  name: EncString;
  notes: EncString;
  type: CipherType;
  favorite: boolean;
  organizationUseTotp: boolean;
  edit: boolean;
  viewPassword: boolean;
  permissions: CipherPermissionsApi;
  revisionDate: Date;
  localData: LocalData;
  login: Login;
  identity: Identity;
  card: Card;
  secureNote: SecureNote;
  sshKey: SshKey;
  attachments: Attachment[];
  fields: Field[];
  passwordHistory: Password[];
  collectionIds: string[];
  creationDate: Date;
  deletedDate: Date;
  reprompt: CipherRepromptType;
  key: EncString;

  constructor(obj?: CipherData, localData: LocalData = null) {
    super();
    if (obj == null) {
      return;
    }

    this.buildDomainModel(
      this,
      obj,
      {
        id: null,
        organizationId: null,
        folderId: null,
        name: null,
        notes: null,
        key: null,
      },
      ["id", "organizationId", "folderId"],
    );

    this.type = obj.type;
    this.favorite = obj.favorite;
    this.organizationUseTotp = obj.organizationUseTotp;
    this.edit = obj.edit;
    if (obj.viewPassword != null) {
      this.viewPassword = obj.viewPassword;
    } else {
      this.viewPassword = true; // Default for already synced Ciphers without viewPassword
    }
    this.permissions = obj.permissions;
    this.revisionDate = obj.revisionDate != null ? new Date(obj.revisionDate) : null;
    this.collectionIds = obj.collectionIds;
    this.localData = localData;
    this.creationDate = obj.creationDate != null ? new Date(obj.creationDate) : null;
    this.deletedDate = obj.deletedDate != null ? new Date(obj.deletedDate) : null;
    this.reprompt = obj.reprompt;

    switch (this.type) {
      case CipherType.Login:
        this.login = new Login(obj.login);
        break;
      case CipherType.SecureNote:
        this.secureNote = new SecureNote(obj.secureNote);
        break;
      case CipherType.Card:
        this.card = new Card(obj.card);
        break;
      case CipherType.Identity:
        this.identity = new Identity(obj.identity);
        break;
      case CipherType.SshKey:
        this.sshKey = new SshKey(obj.sshKey);
        break;
      default:
        break;
    }

    if (obj.attachments != null) {
      this.attachments = obj.attachments.map((a) => new Attachment(a));
    } else {
      this.attachments = null;
    }

    if (obj.fields != null) {
      this.fields = obj.fields.map((f) => new Field(f));
    } else {
      this.fields = null;
    }

    if (obj.passwordHistory != null) {
      this.passwordHistory = obj.passwordHistory.map((ph) => new Password(ph));
    } else {
      this.passwordHistory = null;
    }
  }

  // We are passing the organizationId into the EncString.decrypt() method here, but because the encKey will always be
  // present and so the organizationId will not be used.
  // We will refactor the EncString.decrypt() in https://bitwarden.atlassian.net/browse/PM-3762 to remove the dependency on the organizationId.
  async decrypt(encKey: SymmetricCryptoKey): Promise<CipherView> {
    const model = new CipherView(this);
    let bypassValidation = true;

    if (this.key != null) {
      const encryptService = Utils.getContainerService().getEncryptService();

      try {
        const cipherKey = await encryptService.unwrapSymmetricKey(this.key, encKey);
        encKey = cipherKey;
        bypassValidation = false;
      } catch {
        model.name = "[error: cannot decrypt]";
        model.decryptionFailure = true;
        return model;
      }
    }

    await this.decryptObj<Cipher, CipherView>(
      this,
      model,
      ["name", "notes"],
      this.organizationId,
      encKey,
    );

    switch (this.type) {
      case CipherType.Login:
        model.login = await this.login.decrypt(
          this.organizationId,
          bypassValidation,
          `Cipher Id: ${this.id}`,
          encKey,
        );
        break;
      case CipherType.SecureNote:
        model.secureNote = await this.secureNote.decrypt(
          this.organizationId,
          `Cipher Id: ${this.id}`,
          encKey,
        );
        break;
      case CipherType.Card:
        model.card = await this.card.decrypt(this.organizationId, `Cipher Id: ${this.id}`, encKey);
        break;
      case CipherType.Identity:
        model.identity = await this.identity.decrypt(
          this.organizationId,
          `Cipher Id: ${this.id}`,
          encKey,
        );
        break;
      case CipherType.SshKey:
        model.sshKey = await this.sshKey.decrypt(
          this.organizationId,
          `Cipher Id: ${this.id}`,
          encKey,
        );
        break;
      default:
        break;
    }

    if (this.attachments != null && this.attachments.length > 0) {
      const attachments: AttachmentView[] = [];
      for (const attachment of this.attachments) {
        attachments.push(
          await attachment.decrypt(this.organizationId, `Cipher Id: ${this.id}`, encKey),
        );
      }
      model.attachments = attachments;
    }

    if (this.fields != null && this.fields.length > 0) {
      const fields: FieldView[] = [];
      for (const field of this.fields) {
        fields.push(await field.decrypt(this.organizationId, encKey));
      }
      model.fields = fields;
    }

    if (this.passwordHistory != null && this.passwordHistory.length > 0) {
      const passwordHistory: PasswordHistoryView[] = [];
      for (const ph of this.passwordHistory) {
        passwordHistory.push(await ph.decrypt(this.organizationId, encKey));
      }
      model.passwordHistory = passwordHistory;
    }

    return model;
  }

  toCipherData(): CipherData {
    const c = new CipherData();
    c.id = this.id;
    c.organizationId = this.organizationId;
    c.folderId = this.folderId;
    c.edit = this.edit;
    c.viewPassword = this.viewPassword;
    c.organizationUseTotp = this.organizationUseTotp;
    c.favorite = this.favorite;
    c.revisionDate = this.revisionDate != null ? this.revisionDate.toISOString() : null;
    c.type = this.type;
    c.collectionIds = this.collectionIds;
    c.creationDate = this.creationDate != null ? this.creationDate.toISOString() : null;
    c.deletedDate = this.deletedDate != null ? this.deletedDate.toISOString() : null;
    c.reprompt = this.reprompt;
    c.key = this.key?.encryptedString;
    c.permissions = this.permissions;

    this.buildDataModel(this, c, {
      name: null,
      notes: null,
    });

    switch (c.type) {
      case CipherType.Login:
        c.login = this.login.toLoginData();
        break;
      case CipherType.SecureNote:
        c.secureNote = this.secureNote.toSecureNoteData();
        break;
      case CipherType.Card:
        c.card = this.card.toCardData();
        break;
      case CipherType.Identity:
        c.identity = this.identity.toIdentityData();
        break;
      case CipherType.SshKey:
        c.sshKey = this.sshKey.toSshKeyData();
        break;
      default:
        break;
    }

    if (this.fields != null) {
      c.fields = this.fields.map((f) => f.toFieldData());
    }
    if (this.attachments != null) {
      c.attachments = this.attachments.map((a) => a.toAttachmentData());
    }
    if (this.passwordHistory != null) {
      c.passwordHistory = this.passwordHistory.map((ph) => ph.toPasswordHistoryData());
    }
    return c;
  }

  static fromJSON(obj: Jsonify<Cipher>) {
    if (obj == null) {
      return null;
    }

    const domain = new Cipher();
    const name = EncString.fromJSON(obj.name);
    const notes = EncString.fromJSON(obj.notes);
    const creationDate = obj.creationDate == null ? null : new Date(obj.creationDate);
    const revisionDate = obj.revisionDate == null ? null : new Date(obj.revisionDate);
    const deletedDate = obj.deletedDate == null ? null : new Date(obj.deletedDate);
    const attachments = obj.attachments?.map((a: any) => Attachment.fromJSON(a));
    const fields = obj.fields?.map((f: any) => Field.fromJSON(f));
    const passwordHistory = obj.passwordHistory?.map((ph: any) => Password.fromJSON(ph));
    const key = EncString.fromJSON(obj.key);

    Object.assign(domain, obj, {
      name,
      notes,
      creationDate,
      revisionDate,
      deletedDate,
      attachments,
      fields,
      passwordHistory,
      key,
    });

    switch (obj.type) {
      case CipherType.Card:
        domain.card = Card.fromJSON(obj.card);
        break;
      case CipherType.Identity:
        domain.identity = Identity.fromJSON(obj.identity);
        break;
      case CipherType.Login:
        domain.login = Login.fromJSON(obj.login);
        break;
      case CipherType.SecureNote:
        domain.secureNote = SecureNote.fromJSON(obj.secureNote);
        break;
      case CipherType.SshKey:
        domain.sshKey = SshKey.fromJSON(obj.sshKey);
        break;
      default:
        break;
    }

    return domain;
  }

  /**
   * Maps Cipher to SDK format.
   *
   * @returns {SdkCipher} The SDK cipher object.
   */
  toSdkCipher(): SdkCipher {
    const sdkCipher: SdkCipher = {
      id: asUuid<SdkCipherId>(this.id),
      organizationId: asUuid<SdkOrganizationId>(this.organizationId) ?? undefined,
      folderId: asUuid<SdkFolderId>(this.folderId) ?? undefined,
      collectionIds: this.collectionIds.map((cid) => asUuid<SdkCollectionId>(cid)) ?? [],
      key: this.key?.toSdk(),
      name: this.name.toSdk(),
      notes: this.notes?.toSdk(),
      type: this.type,
      favorite: this.favorite ?? false,
      organizationUseTotp: this.organizationUseTotp ?? false,
      edit: this.edit ?? true,
      permissions: this.permissions
        ? {
            delete: this.permissions.delete,
            restore: this.permissions.restore,
          }
        : undefined,
      viewPassword: this.viewPassword ?? true,
      localData: toSdkLocalData(this.localData),
      attachments: this.attachments?.map((a) => a.toSdkAttachment()),
      fields: this.fields?.map((f) => f.toSdkField()),
      passwordHistory: this.passwordHistory?.map((ph) => ph.toSdkPasswordHistory()),
      revisionDate: this.revisionDate?.toISOString(),
      creationDate: this.creationDate?.toISOString(),
      deletedDate: this.deletedDate?.toISOString(),
      reprompt: this.reprompt,
      // Initialize all cipher-type-specific properties as undefined
      login: undefined,
      identity: undefined,
      card: undefined,
      secureNote: undefined,
      sshKey: undefined,
    };

    switch (this.type) {
      case CipherType.Login:
        sdkCipher.login = this.login.toSdkLogin();
        break;
      case CipherType.SecureNote:
        sdkCipher.secureNote = this.secureNote.toSdkSecureNote();
        break;
      case CipherType.Card:
        sdkCipher.card = this.card.toSdkCard();
        break;
      case CipherType.Identity:
        sdkCipher.identity = this.identity.toSdkIdentity();
        break;
      case CipherType.SshKey:
        sdkCipher.sshKey = this.sshKey.toSdkSshKey();
        break;
      default:
        break;
    }

    return sdkCipher;
  }

  /**
   * Maps an SDK Cipher object to a Cipher
   * @param sdkCipher - The SDK Cipher object
   */
  static fromSdkCipher(sdkCipher: SdkCipher | null): Cipher | undefined {
    if (sdkCipher == null) {
      return undefined;
    }

    const cipher = new Cipher();

    cipher.id = sdkCipher.id ? uuidToString(sdkCipher.id) : undefined;
    cipher.organizationId = sdkCipher.organizationId
      ? uuidToString(sdkCipher.organizationId)
      : undefined;
    cipher.folderId = sdkCipher.folderId ? uuidToString(sdkCipher.folderId) : undefined;
    cipher.collectionIds = sdkCipher.collectionIds ? sdkCipher.collectionIds.map(uuidToString) : [];
    cipher.key = EncString.fromJSON(sdkCipher.key);
    cipher.name = EncString.fromJSON(sdkCipher.name);
    cipher.notes = EncString.fromJSON(sdkCipher.notes);
    cipher.type = sdkCipher.type;
    cipher.favorite = sdkCipher.favorite;
    cipher.organizationUseTotp = sdkCipher.organizationUseTotp;
    cipher.edit = sdkCipher.edit;
    cipher.permissions = CipherPermissionsApi.fromSdkCipherPermissions(sdkCipher.permissions);
    cipher.viewPassword = sdkCipher.viewPassword;
    cipher.localData = fromSdkLocalData(sdkCipher.localData);
    cipher.attachments = sdkCipher.attachments?.map((a) => Attachment.fromSdkAttachment(a)) ?? [];
    cipher.fields = sdkCipher.fields?.map((f) => Field.fromSdkField(f)) ?? [];
    cipher.passwordHistory =
      sdkCipher.passwordHistory?.map((ph) => Password.fromSdkPasswordHistory(ph)) ?? [];
    cipher.creationDate = new Date(sdkCipher.creationDate);
    cipher.revisionDate = new Date(sdkCipher.revisionDate);
    cipher.deletedDate = sdkCipher.deletedDate ? new Date(sdkCipher.deletedDate) : null;
    cipher.reprompt = sdkCipher.reprompt;

    // Cipher type specific properties
    cipher.login = Login.fromSdkLogin(sdkCipher.login);
    cipher.secureNote = SecureNote.fromSdkSecureNote(sdkCipher.secureNote);
    cipher.card = Card.fromSdkCard(sdkCipher.card);
    cipher.identity = Identity.fromSdkIdentity(sdkCipher.identity);
    cipher.sshKey = SshKey.fromSdkSshKey(sdkCipher.sshKey);

    return cipher;
  }
}
