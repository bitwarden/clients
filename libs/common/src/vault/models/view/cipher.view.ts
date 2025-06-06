// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CipherView as SdkCipherView } from "@bitwarden/sdk-internal";

import { View } from "../../../models/view/view";
import { InitializerMetadata } from "../../../platform/interfaces/initializer-metadata.interface";
import { InitializerKey } from "../../../platform/services/cryptography/initializer-key";
import { DeepJsonify } from "../../../types/deep-jsonify";
import { CipherType, LinkedIdType } from "../../enums";
import { CipherRepromptType } from "../../enums/cipher-reprompt-type";
import { CipherPermissionsApi } from "../api/cipher-permissions.api";
import { LocalData } from "../data/local.data";
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

  id: string = null;
  organizationId: string | undefined = null;
  folderId: string = null;
  name: string = null;
  notes: string = null;
  type: CipherType = null;
  favorite = false;
  organizationUseTotp = false;
  permissions: CipherPermissionsApi = new CipherPermissionsApi();
  edit = false;
  viewPassword = true;
  localData: LocalData;
  login = new LoginView();
  identity = new IdentityView();
  card = new CardView();
  secureNote = new SecureNoteView();
  sshKey = new SshKeyView();
  attachments: AttachmentView[] = null;
  fields: FieldView[] = null;
  passwordHistory: PasswordHistoryView[] = null;
  collectionIds: string[] = null;
  revisionDate: Date = null;
  creationDate: Date = null;
  deletedDate: Date = null;
  reprompt: CipherRepromptType = CipherRepromptType.None;

  /**
   * Flag to indicate if the cipher decryption failed.
   */
  decryptionFailure = false;

  constructor(c?: Cipher) {
    if (!c) {
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
    // Old locally stored ciphers might have reprompt == null. If so set it to None.
    this.reprompt = c.reprompt ?? CipherRepromptType.None;
  }

  private get item() {
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

    return null;
  }

  get subTitle(): string {
    return this.item?.subTitle;
  }

  get hasPasswordHistory(): boolean {
    return this.passwordHistory && this.passwordHistory.length > 0;
  }

  get hasAttachments(): boolean {
    return this.attachments && this.attachments.length > 0;
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

  get passwordRevisionDisplayDate(): Date {
    if (this.type !== CipherType.Login || this.login == null) {
      return null;
    } else if (this.login.password == null || this.login.password === "") {
      return null;
    }
    return this.login.passwordRevisionDate;
  }

  get isDeleted(): boolean {
    return this.deletedDate != null;
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
    return this.type === CipherType.Login && this.login.canLaunch;
  }

  linkedFieldValue(id: LinkedIdType) {
    const linkedFieldOption = this.linkedFieldOptions?.get(id);
    if (linkedFieldOption == null) {
      return null;
    }

    // FIXME: Remove when updating file. Eslint update
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const item = this.item;
    return this.item[linkedFieldOption.propertyKey as keyof typeof item];
  }

  linkedFieldI18nKey(id: LinkedIdType): string {
    return this.linkedFieldOptions.get(id)?.i18nKey;
  }

  // This is used as a marker to indicate that the cipher view object still has its prototype
  toJSON() {
    return this;
  }

  static fromJSON(obj: Partial<DeepJsonify<CipherView>>): CipherView {
    if (obj == null) {
      return null;
    }

    const view = new CipherView();
    const creationDate = obj.creationDate == null ? null : new Date(obj.creationDate);
    const revisionDate = obj.revisionDate == null ? null : new Date(obj.revisionDate);
    const deletedDate = obj.deletedDate == null ? null : new Date(obj.deletedDate);
    const attachments = obj.attachments?.map((a: any) => AttachmentView.fromJSON(a));
    const fields = obj.fields?.map((f: any) => FieldView.fromJSON(f));
    const passwordHistory = obj.passwordHistory?.map((ph: any) => PasswordHistoryView.fromJSON(ph));

    Object.assign(view, obj, {
      creationDate: creationDate,
      revisionDate: revisionDate,
      deletedDate: deletedDate,
      attachments: attachments,
      fields: fields,
      passwordHistory: passwordHistory,
    });

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
    cipherView.id = obj.id ?? null;
    cipherView.organizationId = obj.organizationId ?? null;
    cipherView.folderId = obj.folderId ?? null;
    cipherView.name = obj.name;
    cipherView.notes = obj.notes ?? null;
    cipherView.type = obj.type;
    cipherView.favorite = obj.favorite;
    cipherView.organizationUseTotp = obj.organizationUseTotp;
    cipherView.permissions = CipherPermissionsApi.fromSdkCipherPermissions(obj.permissions);
    cipherView.edit = obj.edit;
    cipherView.viewPassword = obj.viewPassword;
    cipherView.localData = obj.localData
      ? {
          lastUsedDate: obj.localData.lastUsedDate
            ? new Date(obj.localData.lastUsedDate).getTime()
            : undefined,
          lastLaunched: obj.localData.lastLaunched
            ? new Date(obj.localData.lastLaunched).getTime()
            : undefined,
        }
      : undefined;
    cipherView.attachments =
      obj.attachments?.map((a) => AttachmentView.fromSdkAttachmentView(a)) ?? null;
    cipherView.fields = obj.fields?.map((f) => FieldView.fromSdkFieldView(f)) ?? null;
    cipherView.passwordHistory =
      obj.passwordHistory?.map((ph) => PasswordHistoryView.fromSdkPasswordHistoryView(ph)) ?? null;
    cipherView.collectionIds = obj.collectionIds ?? null;
    cipherView.revisionDate = obj.revisionDate == null ? null : new Date(obj.revisionDate);
    cipherView.creationDate = obj.creationDate == null ? null : new Date(obj.creationDate);
    cipherView.deletedDate = obj.deletedDate == null ? null : new Date(obj.deletedDate);
    cipherView.reprompt = obj.reprompt ?? CipherRepromptType.None;

    switch (obj.type) {
      case CipherType.Card:
        cipherView.card = CardView.fromSdkCardView(obj.card);
        break;
      case CipherType.Identity:
        cipherView.identity = IdentityView.fromSdkIdentityView(obj.identity);
        break;
      case CipherType.Login:
        cipherView.login = LoginView.fromSdkLoginView(obj.login);
        break;
      case CipherType.SecureNote:
        cipherView.secureNote = SecureNoteView.fromSdkSecureNoteView(obj.secureNote);
        break;
      case CipherType.SshKey:
        cipherView.sshKey = SshKeyView.fromSdkSshKeyView(obj.sshKey);
        break;
      default:
        break;
    }

    return cipherView;
  }
}
