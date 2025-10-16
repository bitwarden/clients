import { CommonModule } from "@angular/common";
import {
  Input,
  Output,
  EventEmitter,
  Component,
  OnInit,
  ViewChild,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { firstValueFrom, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { ButtonComponent, ButtonModule, DialogService, ToastService } from "@bitwarden/components";
import { ArchiveCipherUtilitiesService, PasswordRepromptService } from "@bitwarden/vault";

@Component({
  selector: "app-vault-item-footer",
  templateUrl: "item-footer.component.html",
  imports: [ButtonModule, CommonModule, JslibModule],
})
export class ItemFooterComponent implements OnInit, OnChanges {
  @Input({ required: true }) cipher: CipherView = new CipherView();
  @Input() collectionId: string | null = null;
  @Input({ required: true }) action: string = "view";
  @Input() masterPasswordAlreadyPrompted: boolean = false;
  @Output() onEdit = new EventEmitter<CipherView>();
  @Output() onClone = new EventEmitter<CipherView>();
  @Output() onDelete = new EventEmitter<CipherView>();
  @Output() onRestore = new EventEmitter<CipherView>();
  @Output() onCancel = new EventEmitter<CipherView>();
  @Output() onArchiveToggle = new EventEmitter<CipherView>();
  @ViewChild("submitBtn", { static: false }) submitBtn: ButtonComponent | null = null;

  activeUserId: UserId | null = null;
  passwordReprompted: boolean = false;

  protected showArchive = false;

  constructor(
    protected cipherService: CipherService,
    protected dialogService: DialogService,
    protected passwordRepromptService: PasswordRepromptService,
    protected cipherAuthorizationService: CipherAuthorizationService,
    protected accountService: AccountService,
    protected toastService: ToastService,
    protected i18nService: I18nService,
    protected logService: LogService,
    protected cipherArchiveService: CipherArchiveService,
    protected archiveCipherUtilitiesService: ArchiveCipherUtilitiesService,
  ) {}

  async ngOnInit() {
    this.activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    this.passwordReprompted = this.masterPasswordAlreadyPrompted;
    await this.checkArchiveState();
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (changes.cipher) {
      await this.checkArchiveState();
    }
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
      this.onClone.emit(this.cipher);
      return true;
    }

    return false;
  }

  protected edit() {
    this.onEdit.emit(this.cipher);
  }

  protected get hasFooterAction() {
    return (
      this.showArchive ||
      (this.cipher.permissions?.delete && (this.action === "edit" || this.action === "view"))
    );
  }

  cancel() {
    this.onCancel.emit(this.cipher);
  }

  async delete(): Promise<boolean> {
    if (!(await this.promptPassword())) {
      return false;
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
        message: this.i18nService.t(
          this.cipher.isDeleted ? "permanentlyDeletedItem" : "deletedItem",
        ),
      });
      this.onDelete.emit(this.cipher);
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
        message: this.i18nService.t("restoredItem"),
      });
      this.onRestore.emit(this.cipher);
    } catch (e) {
      this.logService.error(e);
    }

    return true;
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

  protected async archive() {
    await this.archiveCipherUtilitiesService.archiveCipher(this.cipher);
    this.onArchiveToggle.emit();
  }

  protected async unarchive() {
    await this.archiveCipherUtilitiesService.unarchiveCipher(this.cipher);
    this.onArchiveToggle.emit();
  }

  private async checkArchiveState() {
    const cipherCanBeArchived = !this.cipher.isDeleted && this.cipher.organizationId == null;
    const userCanArchive = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        getUserId,
        switchMap((id) => this.cipherArchiveService.userCanArchive$(id)),
      ),
    );

    this.showArchive = cipherCanBeArchived && userCanArchive && this.action === "view";
  }
}
