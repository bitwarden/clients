import { Jsonify } from "type-fest";

import { Cipher as SdkCipher } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { EncString } from "../../../key-management/crypto/models/enc-string";
import { asUuid, uuidAsString } from "../../../platform/abstractions/sdk/sdk.service";
import { Decryptable } from "../../../platform/interfaces/decryptable.interface";
import { Utils } from "../../../platform/misc/utils";
import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { InitializerKey } from "../../../platform/services/cryptography/initializer-key";
import { CipherRepromptType } from "../../enums/cipher-reprompt-type";
import { CipherType } from "../../enums/cipher-type";
import { conditionalEncString, encStringFrom } from "../../utils/domain-utils";
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

  id: string = "";
  organizationId?: string;
  folderId?: string;
  name: EncString = new EncString("");
  notes?: EncString;
  type: CipherType = CipherType.Login;
  favorite: boolean = false;
  organizationUseTotp: boolean = false;
  edit: boolean = false;
  viewPassword: boolean = true;
  permissions?: CipherPermissionsApi;
  revisionDate: Date;
  localData?: LocalData;
  login?: Login;
  identity?: Identity;
  card?: Card;
  secureNote?: SecureNote;
  sshKey?: SshKey;
  attachments?: Attachment[];
  fields?: Field[];
  passwordHistory?: Password[];
  collectionIds: string[] = [];
  creationDate: Date;
  deletedDate?: Date;
  archivedDate?: Date;
  reprompt: CipherRepromptType = CipherRepromptType.None;
  key?: EncString;

  constructor(obj?: CipherData, localData?: LocalData) {
    super();
    if (obj == null) {
      this.creationDate = this.revisionDate = new Date();
      return;
    }

    this.id = obj.id;
    this.organizationId = obj.organizationId;
    this.folderId = obj.folderId;
    this.name = new EncString(obj.name);
    this.notes = conditionalEncString(obj.notes);
    this.type = obj.type;
    this.favorite = obj.favorite;
    this.organizationUseTotp = obj.organizationUseTotp;
    this.edit = obj.edit;
    this.viewPassword = obj.viewPassword;
    this.permissions = obj.permissions;
    this.revisionDate = new Date(obj.revisionDate);
    this.localData = localData;
    this.collectionIds = obj.collectionIds ?? [];
    this.creationDate = new Date(obj.creationDate);
    this.deletedDate = obj.deletedDate != null ? new Date(obj.deletedDate) : undefined;
    this.archivedDate = obj.archivedDate != null ? new Date(obj.archivedDate) : undefined;
    this.reprompt = obj.reprompt;
    this.key = conditionalEncString(obj.key);

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
    }

    if (obj.fields != null) {
      this.fields = obj.fields.map((f) => new Field(f));
    }

    if (obj.passwordHistory != null) {
      this.passwordHistory = obj.passwordHistory.map((ph) => new Password(ph));
    }
  }

  // We are passing the organizationId into the EncString.decrypt() method here, but because the encKey will always be
  // present and so the organizationId will not be used.
  // We will refactor the EncString.decrypt() in https://bitwarden.atlassian.net/browse/PM-3762 to remove the dependency on the organizationId.
  async decrypt(encKey: SymmetricCryptoKey, userId: UserId): Promise<CipherView> {
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
      userId,
      this.organizationId ?? null,
      encKey,
      "cipher",
    );

    switch (this.type) {
      case CipherType.Login:
        if (this.login != null) {
          model.login = await this.login.decrypt(
            userId,
            this.organizationId,
            bypassValidation,
            `Cipher Id: ${this.id}`,
            encKey,
          );
        }
        break;
      case CipherType.SecureNote:
        if (this.secureNote != null) {
          model.secureNote = await this.secureNote.decrypt();
        }
        break;
      case CipherType.Card:
        if (this.card != null) {
          model.card = await this.card.decrypt(
            userId,
            this.organizationId,
            `Cipher Id: ${this.id}`,
            encKey,
          );
        }
        break;
      case CipherType.Identity:
        if (this.identity != null) {
          model.identity = await this.identity.decrypt(
            userId,
            this.organizationId,
            `Cipher Id: ${this.id}`,
            encKey,
          );
        }
        break;
      case CipherType.SshKey:
        if (this.sshKey != null) {
          model.sshKey = await this.sshKey.decrypt(
            userId,
            this.organizationId,
            `Cipher Id: ${this.id}`,
            encKey,
          );
        }
        break;
      default:
        break;
    }

    if (this.attachments != null && this.attachments.length > 0) {
      const attachments: AttachmentView[] = [];
      for (const attachment of this.attachments) {
        const decryptedAttachment = await attachment.decrypt(
          userId,
          this.organizationId,
          `Cipher Id: ${this.id}`,
          encKey,
        );
        attachments.push(decryptedAttachment);
      }
      model.attachments = attachments;
    }

    if (this.fields != null && this.fields.length > 0) {
      const fields: FieldView[] = [];
      for (const field of this.fields) {
        const decryptedField = await field.decrypt(userId, this.organizationId, encKey);
        fields.push(decryptedField);
      }
      model.fields = fields;
    }

    if (this.passwordHistory != null && this.passwordHistory.length > 0) {
      const passwordHistory: PasswordHistoryView[] = [];
      for (const ph of this.passwordHistory) {
        const decryptedPh = await ph.decrypt(userId, this.organizationId, encKey);
        passwordHistory.push(decryptedPh);
      }
      model.passwordHistory = passwordHistory;
    }

    return model;
  }

  toCipherData(): CipherData {
    const c = new CipherData();
    c.id = this.id;
    if (this.organizationId != null) {
      c.organizationId = this.organizationId;
    }

    if (this.folderId != null) {
      c.folderId = this.folderId;
    }
    c.edit = this.edit;
    c.viewPassword = this.viewPassword;
    c.organizationUseTotp = this.organizationUseTotp;
    c.favorite = this.favorite;
    c.revisionDate = this.revisionDate.toISOString();
    c.type = this.type;
    c.collectionIds = this.collectionIds;
    c.creationDate = this.creationDate.toISOString();
    c.deletedDate = this.deletedDate != null ? this.deletedDate.toISOString() : undefined;
    c.reprompt = this.reprompt;

    if (this.key != null && this.key.encryptedString != null) {
      c.key = this.key.encryptedString;
    }

    if (this.permissions != null) {
      c.permissions = this.permissions;
    }

    c.archivedDate = this.archivedDate != null ? this.archivedDate.toISOString() : undefined;

    this.buildDataModel(this, c, {
      name: null,
      notes: null,
    });

    switch (c.type) {
      case CipherType.Login:
        if (this.login != null) {
          c.login = this.login.toLoginData();
        }
        break;
      case CipherType.SecureNote:
        if (this.secureNote != null) {
          c.secureNote = this.secureNote.toSecureNoteData();
        }
        break;
      case CipherType.Card:
        if (this.card != null) {
          c.card = this.card.toCardData();
        }
        break;
      case CipherType.Identity:
        if (this.identity != null) {
          c.identity = this.identity.toIdentityData();
        }
        break;
      case CipherType.SshKey:
        if (this.sshKey != null) {
          c.sshKey = this.sshKey.toSshKeyData();
        }
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

  static fromJSON(obj: Jsonify<Cipher> | undefined): Cipher | undefined {
    if (obj == null) {
      return undefined;
    }

    const domain = new Cipher();

    domain.id = obj.id;
    domain.organizationId = obj.organizationId;
    domain.folderId = obj.folderId;
    domain.type = obj.type;
    domain.favorite = obj.favorite;
    domain.organizationUseTotp = obj.organizationUseTotp;
    domain.edit = obj.edit;
    domain.viewPassword = obj.viewPassword;

    if (obj.permissions != null) {
      domain.permissions = new CipherPermissionsApi(obj.permissions);
    }

    domain.collectionIds = obj.collectionIds;
    domain.localData = obj.localData;
    domain.reprompt = obj.reprompt;
    domain.creationDate = new Date(obj.creationDate);
    domain.revisionDate = new Date(obj.revisionDate);
    domain.deletedDate = obj.deletedDate != null ? new Date(obj.deletedDate) : undefined;
    domain.archivedDate = obj.archivedDate != null ? new Date(obj.archivedDate) : undefined;
    domain.name = EncString.fromJSON(obj.name);
    domain.notes = encStringFrom(obj.notes);
    domain.key = encStringFrom(obj.key);
    domain.attachments = obj.attachments
      ?.map((a: any) => Attachment.fromJSON(a))
      .filter((a): a is Attachment => a != null);
    domain.fields = obj.fields
      ?.map((f: any) => Field.fromJSON(f))
      .filter((f): f is Field => f != null);
    domain.passwordHistory = obj.passwordHistory
      ?.map((ph: any) => Password.fromJSON(ph))
      .filter((ph): ph is Password => ph != null);

    switch (obj.type) {
      case CipherType.Card:
        if (obj.card != null) {
          domain.card = Card.fromJSON(obj.card);
        }
        break;
      case CipherType.Identity:
        if (obj.identity != null) {
          domain.identity = Identity.fromJSON(obj.identity);
        }
        break;
      case CipherType.Login:
        if (obj.login != null) {
          domain.login = Login.fromJSON(obj.login);
        }
        break;
      case CipherType.SecureNote:
        if (obj.secureNote != null) {
          domain.secureNote = SecureNote.fromJSON(obj.secureNote);
        }
        break;
      case CipherType.SshKey:
        if (obj.sshKey != null) {
          domain.sshKey = SshKey.fromJSON(obj.sshKey);
        }
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
      id: this.id ? asUuid(this.id) : undefined,
      organizationId: this.organizationId ? asUuid(this.organizationId) : undefined,
      folderId: this.folderId ? asUuid(this.folderId) : undefined,
      collectionIds: this.collectionIds ? this.collectionIds.map(asUuid) : ([] as any),
      key: this.key?.toSdk(),
      name: this.name.toSdk(),
      notes: this.notes?.toSdk(),
      type: this.type,
      favorite: this.favorite,
      organizationUseTotp: this.organizationUseTotp,
      edit: this.edit,
      permissions: this.permissions
        ? {
            delete: this.permissions.delete,
            restore: this.permissions.restore,
          }
        : undefined,
      viewPassword: this.viewPassword,
      localData: toSdkLocalData(this.localData),
      attachments: this.attachments?.map((a) => a.toSdkAttachment()),
      fields: this.fields?.map((f) => f.toSdkField()),
      passwordHistory: this.passwordHistory?.map((ph) => ph.toSdkPasswordHistory()),
      revisionDate: this.revisionDate.toISOString(),
      creationDate: this.creationDate.toISOString(),
      deletedDate: this.deletedDate?.toISOString(),
      archivedDate: this.archivedDate?.toISOString(),
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
        if (this.login != null) {
          sdkCipher.login = this.login.toSdkLogin();
        }
        break;
      case CipherType.SecureNote:
        if (this.secureNote != null) {
          sdkCipher.secureNote = this.secureNote.toSdkSecureNote();
        }
        break;
      case CipherType.Card:
        if (this.card != null) {
          sdkCipher.card = this.card.toSdkCard();
        }
        break;
      case CipherType.Identity:
        if (this.identity != null) {
          sdkCipher.identity = this.identity.toSdkIdentity();
        }
        break;
      case CipherType.SshKey:
        if (this.sshKey != null) {
          sdkCipher.sshKey = this.sshKey.toSdkSshKey();
        }
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
  static fromSdkCipher(sdkCipher?: SdkCipher): Cipher | undefined {
    if (sdkCipher == null) {
      return undefined;
    }

    const cipher = new Cipher();

    cipher.id = sdkCipher.id ? uuidAsString(sdkCipher.id) : "";
    cipher.organizationId = sdkCipher.organizationId
      ? uuidAsString(sdkCipher.organizationId)
      : undefined;
    cipher.folderId = sdkCipher.folderId ? uuidAsString(sdkCipher.folderId) : undefined;
    cipher.collectionIds = sdkCipher.collectionIds ? sdkCipher.collectionIds.map(uuidAsString) : [];
    cipher.key = encStringFrom(sdkCipher.key);
    cipher.name = EncString.fromJSON(sdkCipher.name);
    cipher.notes = encStringFrom(sdkCipher.notes);
    cipher.type = sdkCipher.type;
    cipher.favorite = sdkCipher.favorite;
    cipher.organizationUseTotp = sdkCipher.organizationUseTotp;
    cipher.edit = sdkCipher.edit;
    cipher.permissions = CipherPermissionsApi.fromSdkCipherPermissions(sdkCipher.permissions);
    cipher.viewPassword = sdkCipher.viewPassword;
    cipher.localData = fromSdkLocalData(sdkCipher.localData);
    cipher.attachments = sdkCipher.attachments
      ?.map((a) => Attachment.fromSdkAttachment(a))
      .filter((a): a is Attachment => a != null);
    cipher.fields = sdkCipher.fields
      ?.map((f) => Field.fromSdkField(f))
      .filter((f): f is Field => f != null);
    cipher.passwordHistory = sdkCipher.passwordHistory
      ?.map((ph) => Password.fromSdkPasswordHistory(ph))
      .filter((ph): ph is Password => ph != null);
    cipher.creationDate = new Date(sdkCipher.creationDate);
    cipher.revisionDate = new Date(sdkCipher.revisionDate);
    cipher.deletedDate = sdkCipher.deletedDate ? new Date(sdkCipher.deletedDate) : undefined;
    cipher.archivedDate = sdkCipher.archivedDate ? new Date(sdkCipher.archivedDate) : undefined;
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
