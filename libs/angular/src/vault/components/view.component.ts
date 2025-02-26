// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DatePipe } from "@angular/common";
import {
  ChangeDetectorRef,
  Directive,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
} from "@angular/core";
import { filter, firstValueFrom, map, Observable } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EventType } from "@bitwarden/common/enums";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { CollectionId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { TotpService } from "@bitwarden/common/vault/abstractions/totp.service";
import { CipherType, FieldType } from "@bitwarden/common/vault/enums";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import { Launchable } from "@bitwarden/common/vault/interfaces/launchable";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { PasswordRepromptService } from "@bitwarden/vault";

const BroadcasterSubscriptionId = "ViewComponent";

@Directive()
export class ViewComponent implements OnDestroy, OnInit {
  @Input() cipherId: string;
  @Input() collectionId: string;
  @Output() onEditCipher = new EventEmitter<CipherView>();
  @Output() onCloneCipher = new EventEmitter<CipherView>();
  @Output() onShareCipher = new EventEmitter<CipherView>();
  @Output() onDeletedCipher = new EventEmitter<CipherView>();
  @Output() onRestoredCipher = new EventEmitter<CipherView>();

  canDeleteCipher$: Observable<boolean>;
  cipher: CipherView;
  showPassword: boolean;
  showPasswordCount: boolean;
  showCardNumber: boolean;
  showCardCode: boolean;
  showPrivateKey: boolean;
  canAccessPremium: boolean;
  showPremiumRequiredTotp: boolean;
  totpCode: string;
  totpCodeFormatted: string;
  totpDash: number;
  totpSec: number;
  totpLow: boolean;
  fieldType = FieldType;
  checkPasswordPromise: Promise<number>;
  folder: FolderView;
  cipherType = CipherType;

  private totpInterval: any;
  private previousCipherId: string;
  private passwordReprompted = false;

  get fido2CredentialCreationDateValue(): string {
    const dateCreated = this.i18nService.t("dateCreated");
    const creationDate = this.datePipe.transform(
      this.cipher?.login?.fido2Credentials?.[0]?.creationDate,
      "short",
    );
    return `${dateCreated} ${creationDate}`;
  }

  constructor(
    protected cipherService: CipherService,
    protected folderService: FolderService,
    protected totpService: TotpService,
    protected tokenService: TokenService,
    protected i18nService: I18nService,
    protected keyService: KeyService,
    protected encryptService: EncryptService,
    protected platformUtilsService: PlatformUtilsService,
    protected auditService: AuditService,
    protected win: Window,
    protected broadcasterService: BroadcasterService,
    protected ngZone: NgZone,
    protected changeDetectorRef: ChangeDetectorRef,
    protected eventCollectionService: EventCollectionService,
    protected apiService: ApiService,
    protected passwordRepromptService: PasswordRepromptService,
    private logService: LogService,
    protected stateService: StateService,
    protected fileDownloadService: FileDownloadService,
    protected dialogService: DialogService,
    protected datePipe: DatePipe,
    protected accountService: AccountService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    protected toastService: ToastService,
    private cipherAuthorizationService: CipherAuthorizationService,
  ) {}

  ngOnInit() {
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, (message: any) => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.ngZone.run(async () => {
        switch (message.command) {
          case "syncCompleted":
            if (message.successfully) {
              await this.load();
              this.changeDetectorRef.detectChanges();
            }
            break;
        }
      });
    });
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    this.cleanUp();
  }

  async load() {
    this.cleanUp();

    // Grab individual cipher from `cipherViews$` for the most up-to-date information
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.cipher = await firstValueFrom(
      this.cipherService.cipherViews$(activeUserId).pipe(
        map((ciphers) => ciphers?.find((c) => c.id === this.cipherId)),
        filter((cipher) => !!cipher),
      ),
    );

    this.canAccessPremium = await firstValueFrom(
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(activeUserId),
    );
    this.showPremiumRequiredTotp =
      this.cipher.login.totp && !this.canAccessPremium && !this.cipher.organizationUseTotp;
    this.canDeleteCipher$ = this.cipherAuthorizationService.canDeleteCipher$(this.cipher, [
      this.collectionId as CollectionId,
    ]);

    if (this.cipher.folderId) {
      this.folder = await (
        await firstValueFrom(this.folderService.folderViews$(activeUserId))
      ).find((f) => f.id == this.cipher.folderId);
    }

    if (
      this.cipher.type === CipherType.Login &&
      this.cipher.login.totp &&
      (this.cipher.organizationUseTotp || this.canAccessPremium)
    ) {
      await this.totpUpdateCode();
      const interval = this.totpService.getTimeInterval(this.cipher.login.totp);
      await this.totpTick(interval);

      this.totpInterval = setInterval(async () => {
        await this.totpTick(interval);
      }, 1000);
    }

    if (this.previousCipherId !== this.cipherId) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.eventCollectionService.collect(EventType.Cipher_ClientViewed, this.cipherId);
    }
    this.previousCipherId = this.cipherId;
  }

  async edit() {
    if (await this.promptPassword()) {
      this.onEditCipher.emit(this.cipher);
      return true;
    }

    return false;
  }

  async clone() {
    if (this.cipher.login?.hasFido2Credentials) {
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "passkeyNotCopied" },
        content: { key: "passkeyNotCopiedAlert" },
        type: "info",
      });

      if (!confirmed) {
        return false;
      }
    }

    if (await this.promptPassword()) {
      this.onCloneCipher.emit(this.cipher);
      return true;
    }

    return false;
  }

  async share() {
    if (await this.promptPassword()) {
      this.onShareCipher.emit(this.cipher);
      return true;
    }

    return false;
  }

  async delete(): Promise<boolean> {
    if (!(await this.promptPassword())) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: {
        key: this.cipher.isDeleted ? "permanentlyDeleteItemConfirmation" : "deleteItemConfirmation",
      },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    try {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.deleteCipher(activeUserId);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t(
          this.cipher.isDeleted ? "permanentlyDeletedItem" : "deletedItem",
        ),
      });
      this.onDeletedCipher.emit(this.cipher);
    } catch (e) {
      this.logService.error(e);
    }

    return true;
  }

  async restore(): Promise<boolean> {
    if (!this.cipher.isDeleted) {
      return false;
    }

    try {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.restoreCipher(activeUserId);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("restoredItem"),
      });
      this.onRestoredCipher.emit(this.cipher);
    } catch (e) {
      this.logService.error(e);
    }

    return true;
  }

  async togglePassword() {
    if (!(await this.promptPassword())) {
      return;
    }

    this.showPassword = !this.showPassword;
    this.showPasswordCount = false;
    if (this.showPassword) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledPasswordVisible,
        this.cipherId,
      );
    }
  }

  async togglePasswordCount() {
    if (!this.showPassword) {
      return;
    }

    this.showPasswordCount = !this.showPasswordCount;
  }

  async toggleCardNumber() {
    if (!(await this.promptPassword())) {
      return;
    }

    this.showCardNumber = !this.showCardNumber;
    if (this.showCardNumber) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledCardNumberVisible,
        this.cipherId,
      );
    }
  }

  async toggleCardCode() {
    if (!(await this.promptPassword())) {
      return;
    }

    this.showCardCode = !this.showCardCode;
    if (this.showCardCode) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.eventCollectionService.collect(
        EventType.Cipher_ClientToggledCardCodeVisible,
        this.cipherId,
      );
    }
  }

  togglePrivateKey() {
    this.showPrivateKey = !this.showPrivateKey;
  }

  async checkPassword() {
    if (
      this.cipher.login == null ||
      this.cipher.login.password == null ||
      this.cipher.login.password === ""
    ) {
      return;
    }

    this.checkPasswordPromise = this.auditService.passwordLeaked(this.cipher.login.password);
    const matches = await this.checkPasswordPromise;

    if (matches > 0) {
      this.toastService.showToast({
        variant: "warning",
        title: null,
        message: this.i18nService.t("passwordExposed", matches.toString()),
      });
    } else {
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("passwordSafe"),
      });
    }
  }

  async launch(uri: Launchable, cipherId?: string) {
    if (!uri.canLaunch) {
      return;
    }

    if (cipherId) {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      await this.cipherService.updateLastLaunchedDate(cipherId, activeUserId);
    }

    this.platformUtilsService.launchUri(uri.launchUri);
  }

  async copy(value: string, typeI18nKey: string, aType: string): Promise<boolean> {
    if (value == null) {
      return false;
    }

    if (
      this.passwordRepromptService.protectedFields().includes(aType) &&
      !(await this.promptPassword())
    ) {
      return false;
    }

    const copyOptions = this.win != null ? { window: this.win } : null;
    this.platformUtilsService.copyToClipboard(value, copyOptions);
    this.toastService.showToast({
      variant: "info",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t(typeI18nKey)),
    });

    if (typeI18nKey === "password") {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedPassword, this.cipherId);
    } else if (typeI18nKey === "securityCode") {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedCardCode, this.cipherId);
    } else if (aType === "H_Field") {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.eventCollectionService.collect(EventType.Cipher_ClientCopiedHiddenField, this.cipherId);
    }

    return true;
  }

  setTextDataOnDrag(event: DragEvent, data: string) {
    event.dataTransfer.setData("text", data);
  }

  async downloadAttachment(attachment: AttachmentView) {
    if (!(await this.promptPassword())) {
      return;
    }
    const a = attachment as any;
    if (a.downloading) {
      return;
    }

    if (this.cipher.organizationId == null && !this.canAccessPremium) {
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

  protected deleteCipher(userId: UserId) {
    return this.cipher.isDeleted
      ? this.cipherService.deleteWithServer(this.cipher.id, userId)
      : this.cipherService.softDeleteWithServer(this.cipher.id, userId);
  }

  protected restoreCipher(userId: UserId) {
    return this.cipherService.restoreWithServer(this.cipher.id, userId);
  }

  protected async promptPassword() {
    if (this.cipher.reprompt === CipherRepromptType.None || this.passwordReprompted) {
      return true;
    }

    return (this.passwordReprompted = await this.passwordRepromptService.showPasswordPrompt());
  }

  private cleanUp() {
    this.totpCode = null;
    this.cipher = null;
    this.folder = null;
    this.showPassword = false;
    this.showCardNumber = false;
    this.showCardCode = false;
    this.passwordReprompted = false;
    if (this.totpInterval) {
      clearInterval(this.totpInterval);
    }
  }

  private async totpUpdateCode() {
    if (
      this.cipher == null ||
      this.cipher.type !== CipherType.Login ||
      this.cipher.login.totp == null
    ) {
      if (this.totpInterval) {
        clearInterval(this.totpInterval);
      }
      return;
    }

    this.totpCode = await this.totpService.getCode(this.cipher.login.totp);
    if (this.totpCode != null) {
      if (this.totpCode.length > 4) {
        const half = Math.floor(this.totpCode.length / 2);
        this.totpCodeFormatted =
          this.totpCode.substring(0, half) + " " + this.totpCode.substring(half);
      } else {
        this.totpCodeFormatted = this.totpCode;
      }
    } else {
      this.totpCodeFormatted = null;
      if (this.totpInterval) {
        clearInterval(this.totpInterval);
      }
    }
  }

  private async totpTick(intervalSeconds: number) {
    const epoch = Math.round(new Date().getTime() / 1000.0);
    const mod = epoch % intervalSeconds;

    this.totpSec = intervalSeconds - mod;
    this.totpDash = +(Math.round(((78.6 / intervalSeconds) * mod + "e+2") as any) + "e-2");
    this.totpLow = this.totpSec <= 7;
    if (mod === 0) {
      await this.totpUpdateCode();
    }
  }
}
