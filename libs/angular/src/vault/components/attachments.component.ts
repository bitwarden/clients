// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

@Directive()
export class AttachmentsComponent implements OnInit {
  @Input() cipherId: string;
  @Input() viewOnly: boolean;
  @Output() onUploadedAttachment = new EventEmitter<CipherView>();
  @Output() onDeletedAttachment = new EventEmitter();
  @Output() onReuploadedAttachment = new EventEmitter();

  cipher: CipherView;
  cipherDomain: Cipher;
  canAccessAttachments: boolean;
  formPromise: Promise<any>;
  deletePromises: { [id: string]: Promise<CipherData> } = {};
  reuploadPromises: { [id: string]: Promise<any> } = {};
  emergencyAccessId?: string = null;
  protected componentName = "";

  constructor(
    protected cipherService: CipherService,
    protected i18nService: I18nService,
    protected keyService: KeyService,
    protected encryptService: EncryptService,
    protected platformUtilsService: PlatformUtilsService,
    protected apiService: ApiService,
    protected win: Window,
    protected logService: LogService,
    protected stateService: StateService,
    protected fileDownloadService: FileDownloadService,
    protected dialogService: DialogService,
    protected billingAccountProfileStateService: BillingAccountProfileStateService,
    protected accountService: AccountService,
    protected toastService: ToastService,
  ) {}

  async ngOnInit() {
    await this.init();
  }

  async submit() {
    const fileEl = document.getElementById("file") as HTMLInputElement;
    const files = fileEl.files;
    if (files == null || files.length === 0) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("selectFile"),
      });
      return;
    }

    if (files[0].size > 524288000) {
      // 500 MB
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("maxFileSize"),
      });
      return;
    }

    try {
      const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
      this.formPromise = this.saveCipherAttachment(files[0], activeUserId);
      this.cipherDomain = await this.formPromise;
      this.cipher = await this.cipherDomain.decrypt(
        await this.cipherService.getKeyForCipherKeyDecryption(this.cipherDomain, activeUserId),
      );
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("attachmentSaved"),
      });
      this.onUploadedAttachment.emit(this.cipher);
    } catch (e) {
      this.logService.error(e);
    }

    // reset file input
    // ref: https://stackoverflow.com/a/20552042
    fileEl.type = "";
    fileEl.type = "file";
    fileEl.value = "";
  }

  async delete(attachment: AttachmentView) {
    if (this.deletePromises[attachment.id] != null) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteAttachment" },
      content: { key: "deleteAttachmentConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      const activeUserId = await firstValueFrom(getUserId(this.accountService.activeAccount$));

      this.deletePromises[attachment.id] = this.deleteCipherAttachment(attachment.id, activeUserId);
      const updatedCipher = await this.deletePromises[attachment.id];

      const cipher = new Cipher(updatedCipher);
      this.cipher = await cipher.decrypt(
        await this.cipherService.getKeyForCipherKeyDecryption(cipher, activeUserId),
      );

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("deletedAttachment"),
      });
      const i = this.cipher.attachments.indexOf(attachment);
      if (i > -1) {
        this.cipher.attachments.splice(i, 1);
      }
    } catch (e) {
      this.logService.error(e);
    }

    this.deletePromises[attachment.id] = null;
    this.onDeletedAttachment.emit(this.cipher);
  }

  async download(attachment: AttachmentView) {
    const a = attachment as any;
    if (a.downloading) {
      return;
    }

    if (!this.canAccessAttachments) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("premiumRequired"),
        message: this.i18nService.t("premiumRequiredDesc"),
      });
      return;
    }

    let url: string;
    try {
      const attachmentDownloadResponse = await this.apiService.getAttachmentData(
        this.cipher.id,
        attachment.id,
        this.emergencyAccessId,
      );
      url = attachmentDownloadResponse.url;
    } catch (e) {
      if (e instanceof ErrorResponse && (e as ErrorResponse).statusCode === 404) {
        url = attachment.url;
      } else if (e instanceof ErrorResponse) {
        throw new Error((e as ErrorResponse).getSingleMessage());
      } else {
        throw e;
      }
    }

    a.downloading = true;
    const response = await fetch(new Request(url, { cache: "no-store" }));
    if (response.status !== 200) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
      a.downloading = false;
      return;
    }

    try {
      const encBuf = await EncArrayBuffer.fromResponse(response);
      const key =
        attachment.key != null
          ? attachment.key
          : await this.keyService.getOrgKey(this.cipher.organizationId);
      const decBuf = await this.encryptService.decryptToBytes(encBuf, key);
      this.fileDownloadService.download({
        fileName: attachment.fileName,
        blobData: decBuf,
      });
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("fileSavedToDevice"),
      });
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
    }

    a.downloading = false;
  }

  protected async init() {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.cipherDomain = await this.loadCipher(activeUserId);
    this.cipher = await this.cipherDomain.decrypt(
      await this.cipherService.getKeyForCipherKeyDecryption(this.cipherDomain, activeUserId),
    );

    const canAccessPremium = await firstValueFrom(
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(activeUserId),
    );
    this.canAccessAttachments = canAccessPremium || this.cipher.organizationId != null;

    if (!this.canAccessAttachments) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "premiumRequired" },
        content: { key: "premiumRequiredDesc" },
        acceptButtonText: { key: "learnMore" },
        type: "success",
      });

      if (confirmed) {
        this.platformUtilsService.launchUri(
          "https://vault.bitwarden.com/#/settings/subscription/premium",
        );
      }
    }
  }

  protected async reuploadCipherAttachment(attachment: AttachmentView, admin: boolean) {
    const a = attachment as any;
    if (attachment.key != null || a.downloading || this.reuploadPromises[attachment.id] != null) {
      return;
    }

    try {
      this.reuploadPromises[attachment.id] = Promise.resolve().then(async () => {
        // 1. Download
        a.downloading = true;
        const response = await fetch(new Request(attachment.url, { cache: "no-store" }));
        if (response.status !== 200) {
          this.toastService.showToast({
            variant: "error",
            title: null,
            message: this.i18nService.t("errorOccurred"),
          });
          a.downloading = false;
          return;
        }

        try {
          // 2. Resave
          const encBuf = await EncArrayBuffer.fromResponse(response);
          const key =
            attachment.key != null
              ? attachment.key
              : await this.keyService.getOrgKey(this.cipher.organizationId);
          const decBuf = await this.encryptService.decryptToBytes(encBuf, key);
          const activeUserId = await firstValueFrom(
            this.accountService.activeAccount$.pipe(getUserId),
          );
          this.cipherDomain = await this.cipherService.saveAttachmentRawWithServer(
            this.cipherDomain,
            attachment.fileName,
            decBuf,
            activeUserId,
            admin,
          );
          this.cipher = await this.cipherDomain.decrypt(
            await this.cipherService.getKeyForCipherKeyDecryption(this.cipherDomain, activeUserId),
          );

          // 3. Delete old
          this.deletePromises[attachment.id] = this.deleteCipherAttachment(
            attachment.id,
            activeUserId,
          );
          await this.deletePromises[attachment.id];
          const foundAttachment = this.cipher.attachments.filter((a2) => a2.id === attachment.id);
          if (foundAttachment.length > 0) {
            const i = this.cipher.attachments.indexOf(foundAttachment[0]);
            if (i > -1) {
              this.cipher.attachments.splice(i, 1);
            }
          }

          this.toastService.showToast({
            variant: "success",
            title: null,
            message: this.i18nService.t("attachmentSaved"),
          });
          this.onReuploadedAttachment.emit();
          // FIXME: Remove when updating file. Eslint update
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
          this.toastService.showToast({
            variant: "error",
            title: null,
            message: this.i18nService.t("errorOccurred"),
          });
        }

        a.downloading = false;
      });
      await this.reuploadPromises[attachment.id];
    } catch (e) {
      this.logService.error(e);
    }
  }

  protected loadCipher(userId: UserId) {
    return this.cipherService.get(this.cipherId, userId);
  }

  protected saveCipherAttachment(file: File, userId: UserId) {
    return this.cipherService.saveAttachmentWithServer(this.cipherDomain, file, userId);
  }

  protected deleteCipherAttachment(attachmentId: string, userId: UserId) {
    return this.cipherService.deleteAttachmentWithServer(this.cipher.id, attachmentId, userId);
  }

  protected async reupload(attachment: AttachmentView) {
    // TODO: This should be removed but is needed since we re-use the same template
  }
}
