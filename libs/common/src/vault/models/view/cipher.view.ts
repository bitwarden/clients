import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { asUuid, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { ItemView } from "@bitwarden/common/vault/models/view/item.view";
import { CipherView as SdkCipherView } from "@bitwarden/sdk-internal";

import { View } from "../../../models/view/view";
import { InitializerMetadata } from "../../../platform/interfaces/initializer-metadata.interface";
import { InitializerKey } from "../../../platform/services/cryptography/initializer-key";
import { DeepJsonify } from "../../../types/deep-jsonify";
import { CipherType, LinkedIdType } from "../../enums";
import { CipherRepromptType } from "../../enums/cipher-reprompt-type";
import { CipherPermissionsApi } from "../api/cipher-permissions.api";
import { LocalData, toSdkLocalData, fromSdkLocalData } from "../data/local.data";
import { Cipher } from "../domain/cipher";

import { AttachmentView } from "./attachment.view";
import { CardView } from "./card.view";
import { FieldView } from "./field.view";
import { IdentityView } from "./identity.view";
import { LoginView } from "./login.view";
import { PasswordHistoryView } from "./password-history.view";
import { SecureNoteView } from "./secure-note.view";
import { SshKeyView } from "./ssh-key.view";

export class CipherView implements View, InitializerMetadata {
  readonly initializerKey = InitializerKey.CipherView;

  id: string = "";
  organizationId?: string;
  folderId?: string;
  name: string = "";
  notes?: string;
  type: CipherType = CipherType.Login;
  favorite = false;
  organizationUseTotp = false;
  permissions?: CipherPermissionsApi = new CipherPermissionsApi();
  edit = false;
  viewPassword = true;
  localData?: LocalData;
  login = new LoginView();
  identity = new IdentityView();
  card = new CardView();
  secureNote = new SecureNoteView();
  sshKey = new SshKeyView();
  attachments: AttachmentView[] = [];
  fields: FieldView[] = [];
  passwordHistory: PasswordHistoryView[] = [];
  collectionIds: string[] = [];
  revisionDate: Date;
  creationDate: Date;
  deletedDate?: Date;
  archivedDate?: Date;
  reprompt: CipherRepromptType = CipherRepromptType.None;
  // We need a copy of the encrypted key so we can pass it to
  // the SdkCipherView during encryption
  key?: EncString;

  /**
   * Flag to indicate if the cipher decryption failed.
   */
  decryptionFailure = false;

  constructor(c?: Cipher) {
    if (!c) {
      this.creationDate = this.revisionDate = new Date();
      return;
    }

    this.id = c.id;
    this.organizationId = c.organizationId;
    this.folderId = c.folderId;
    this.favorite = c.favorite;
    this.organizationUseTotp = c.organizationUseTotp;
    this.edit = c.edit;
    this.viewPassword = c.viewPassword;
    this.permissions = c.permissions;
    this.type = c.type;
    this.localData = c.localData;
    this.collectionIds = c.collectionIds;
    this.revisionDate = c.revisionDate;
    this.creationDate = c.creationDate;
    this.deletedDate = c.deletedDate;
    this.archivedDate = c.archivedDate;
    // Old locally stored ciphers might have reprompt == null. If so set it to None.
    this.reprompt = c.reprompt ?? CipherRepromptType.None;
    this.key = c.key;
  }

  private get item(): ItemView | undefined {
    switch (this.type) {
      case CipherType.Login:
        return this.login;
      case CipherType.SecureNote:
        return this.secureNote;
      case CipherType.Card:
        return this.card;
      case CipherType.Identity:
        return this.identity;
      case CipherType.SshKey:
        return this.sshKey;
      default:
        break;
    }

    return undefined;
  }

  get subTitle(): string | undefined {
    return this.item?.subTitle;
  }

  get hasPasswordHistory(): boolean {
    return this.passwordHistory && this.passwordHistory.length > 0;
  }

  get hasAttachments(): boolean {
    return !!this.attachments && this.attachments.length > 0;
  }

  get hasOldAttachments(): boolean {
    if (this.hasAttachments) {
      for (let i = 0; i < this.attachments.length; i++) {
        if (this.attachments[i].key == null && this.attachments[i].encryptedKey == null) {
          return true;
        }
      }
    }
    return false;
  }

  get hasFields(): boolean {
    return this.fields && this.fields.length > 0;
  }

  get passwordRevisionDisplayDate(): Date | undefined {
    if (this.type !== CipherType.Login || this.login == null) {
      return undefined;
    } else if (this.login.password == null || this.login.password === "") {
      return undefined;
    }
    return this.login.passwordRevisionDate;
  }

  get isDeleted(): boolean {
    return this.deletedDate != null;
  }

  get isArchived(): boolean {
    return this.archivedDate != null;
  }

  get linkedFieldOptions() {
    return this.item?.linkedFieldOptions;
  }

  get isUnassigned(): boolean {
    return (
      this.organizationId != null && (this.collectionIds == null || this.collectionIds.length === 0)
    );
  }

  get canAssignToCollections(): boolean {
    if (this.organizationId == null) {
      return true;
    }

    return this.edit && this.viewPassword;
  }
  /**
   * Determines if the cipher can be launched in a new browser tab.
   */
  get canLaunch(): boolean {
    return this.type === CipherType.Login && this.login!.canLaunch;
  }

  linkedFieldValue(id: LinkedIdType) {
    const linkedFieldOption = this.linkedFieldOptions?.get(id);
    const item = this.item;
    if (linkedFieldOption == null || item == null) {
      return undefined;
    }

    return item[linkedFieldOption.propertyKey as keyof typeof item];
  }

  // This is used as a marker to indicate that the cipher view object still has its prototype
  toJSON() {
    return this;
  }

  static fromJSON(obj: Partial<DeepJsonify<CipherView>>): CipherView | null {
    if (obj == null) {
      return null;
    }

    const view = new CipherView();
    view.type = obj.type ?? CipherType.Login;
    view.id = obj.id ?? "";
    view.name = obj.name ?? "";
    if (obj.creationDate) {
      view.creationDate = new Date(obj.creationDate);
    }
    if (obj.revisionDate) {
      view.revisionDate = new Date(obj.revisionDate);
    }
    view.deletedDate = obj.deletedDate == null ? undefined : new Date(obj.deletedDate);
    view.archivedDate = obj.archivedDate == null ? undefined : new Date(obj.archivedDate);
    view.attachments = obj.attachments?.map((a: any) => AttachmentView.fromJSON(a)) ?? [];
    view.fields = obj.fields?.map((f: any) => FieldView.fromJSON(f)) ?? [];
    view.passwordHistory =
      obj.passwordHistory?.map((ph: any) => PasswordHistoryView.fromJSON(ph)) ?? [];
    view.permissions = obj.permissions ? CipherPermissionsApi.fromJSON(obj.permissions) : undefined;

    if (obj.key != null) {
      let key: EncString | undefined;
      if (typeof obj.key === "string") {
        // If the key is a string, we need to parse it as EncString
        key = EncString.fromJSON(obj.key);
      } else if ((obj.key as any) instanceof EncString) {
        // If the key is already an EncString instance, we can use it directly
        key = obj.key;
      }
      view.key = key;
    }

    switch (obj.type) {
      case CipherType.Card:
        view.card = CardView.fromJSON(obj.card);
        break;
      case CipherType.Identity:
        view.identity = IdentityView.fromJSON(obj.identity);
        break;
      case CipherType.Login:
        view.login = LoginView.fromJSON(obj.login);
        break;
      case CipherType.SecureNote:
        view.secureNote = SecureNoteView.fromJSON(obj.secureNote);
        break;
      case CipherType.SshKey:
        view.sshKey = SshKeyView.fromJSON(obj.sshKey);
        break;
      default:
        break;
    }

    return view;
  }

  /**
   * Creates a CipherView from the SDK CipherView.
   */
  static fromSdkCipherView(obj: SdkCipherView): CipherView | undefined {
    if (obj == null) {
      return undefined;
    }

    const cipherView = new CipherView();
    cipherView.id = uuidAsString(obj.id);
    cipherView.organizationId = uuidAsString(obj.organizationId);
    cipherView.folderId = uuidAsString(obj.folderId);
    cipherView.name = obj.name;
    cipherView.notes = obj.notes;
    cipherView.type = obj.type;
    cipherView.favorite = obj.favorite;
    cipherView.organizationUseTotp = obj.organizationUseTotp;
    cipherView.permissions = obj.permissions
      ? CipherPermissionsApi.fromSdkCipherPermissions(obj.permissions)
      : undefined;
    cipherView.edit = obj.edit;
    cipherView.viewPassword = obj.viewPassword;
    cipherView.localData = fromSdkLocalData(obj.localData);
    cipherView.attachments =
      obj.attachments?.map((a) => AttachmentView.fromSdkAttachmentView(a)!) ?? [];
    cipherView.fields = obj.fields?.map((f) => FieldView.fromSdkFieldView(f)!) ?? [];
    cipherView.passwordHistory =
      obj.passwordHistory?.map((ph) => PasswordHistoryView.fromSdkPasswordHistoryView(ph)!) ?? [];
    cipherView.collectionIds = obj.collectionIds?.map((i) => uuidAsString(i)) ?? [];
    cipherView.revisionDate = new Date(obj.revisionDate);
    cipherView.creationDate = new Date(obj.creationDate);
    cipherView.deletedDate = obj.deletedDate == null ? undefined : new Date(obj.deletedDate);
    cipherView.archivedDate = obj.archivedDate == null ? undefined : new Date(obj.archivedDate);
    cipherView.reprompt = obj.reprompt ?? CipherRepromptType.None;
    cipherView.key = obj.key ? EncString.fromJSON(obj.key) : undefined;

    switch (obj.type) {
      case CipherType.Card:
        cipherView.card = obj.card ? CardView.fromSdkCardView(obj.card) : new CardView();
        break;
      case CipherType.Identity:
        cipherView.identity = obj.identity
          ? IdentityView.fromSdkIdentityView(obj.identity)
          : new IdentityView();
        break;
      case CipherType.Login:
        cipherView.login = obj.login ? LoginView.fromSdkLoginView(obj.login) : new LoginView();
        break;
      case CipherType.SecureNote:
        cipherView.secureNote = obj.secureNote
          ? SecureNoteView.fromSdkSecureNoteView(obj.secureNote)
          : new SecureNoteView();
        break;
      case CipherType.SshKey:
        cipherView.sshKey = obj.sshKey
          ? SshKeyView.fromSdkSshKeyView(obj.sshKey)
          : new SshKeyView();
        break;
      default:
        break;
    }

    return cipherView;
  }

  /**
   * Maps CipherView to SdkCipherView
   *
   * @returns {SdkCipherView} The SDK cipher view object
   */
  toSdkCipherView(): SdkCipherView {
    const sdkCipherView: SdkCipherView = {
      id: this.id ? asUuid(this.id) : undefined,
      organizationId: this.organizationId ? asUuid(this.organizationId) : undefined,
      folderId: this.folderId ? asUuid(this.folderId) : undefined,
      name: this.name ?? "",
      notes: this.notes,
      type: this.type ?? CipherType.Login,
      favorite: this.favorite ?? false,
      organizationUseTotp: this.organizationUseTotp ?? false,
      permissions: this.permissions?.toSdkCipherPermissions(),
      edit: this.edit ?? true,
      viewPassword: this.viewPassword ?? true,
      localData: toSdkLocalData(this.localData),
      attachments: this.attachments?.map((a) => a.toSdkAttachmentView()),
      fields: this.fields?.map((f) => f.toSdkFieldView()),
      passwordHistory: this.passwordHistory?.map((ph) => ph.toSdkPasswordHistoryView()),
      collectionIds: this.collectionIds?.map((i) => asUuid(i)) ?? [],
      // Revision and creation dates are non-nullable in SDKCipherView
      revisionDate: (this.revisionDate ?? new Date()).toISOString(),
      creationDate: (this.creationDate ?? new Date()).toISOString(),
      deletedDate: this.deletedDate?.toISOString(),
      archivedDate: this.archivedDate?.toISOString(),
      reprompt: this.reprompt ?? CipherRepromptType.None,
      key: this.key?.toSdk(),
      // Cipher type specific properties are set in the switch statement below
      // CipherView initializes each with default constructors (undefined values)
      // The SDK does not expect those undefined values and will throw exceptions
      login: undefined,
      card: undefined,
      identity: undefined,
      secureNote: undefined,
      sshKey: undefined,
    };

    switch (this.type) {
      case CipherType.Card:
        sdkCipherView.card = this.card?.toSdkCardView();
        break;
      case CipherType.Identity:
        sdkCipherView.identity = this.identity?.toSdkIdentityView();
        break;
      case CipherType.Login:
        sdkCipherView.login = this.login?.toSdkLoginView();
        break;
      case CipherType.SecureNote:
        sdkCipherView.secureNote = this.secureNote?.toSdkSecureNoteView();
        break;
      case CipherType.SshKey:
        sdkCipherView.sshKey = this.sshKey?.toSdkSshKeyView();
        break;
      default:
        break;
    }

    return sdkCipherView;
  }
}
