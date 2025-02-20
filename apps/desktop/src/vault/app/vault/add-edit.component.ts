// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DatePipe } from "@angular/common";
import { Component, NgZone, OnChanges, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { NgForm } from "@angular/forms";
import { sshagent as sshAgent } from "desktop_native/napi";
import { lastValueFrom } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { AddEditComponent as BaseAddEditComponent } from "@bitwarden/angular/vault/components/add-edit.component";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { DialogService, ToastService } from "@bitwarden/components";
import { SshKeyPasswordPromptComponent } from "@bitwarden/importer-ui";
import { PasswordRepromptService } from "@bitwarden/vault";

const BroadcasterSubscriptionId = "AddEditComponent";

@Component({
  selector: "app-vault-add-edit",
  templateUrl: "add-edit.component.html",
})
export class AddEditComponent extends BaseAddEditComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild("form")
  private form: NgForm;

  constructor(
    cipherService: CipherService,
    folderService: FolderService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    auditService: AuditService,
    accountService: AccountService,
    collectionService: CollectionService,
    messagingService: MessagingService,
    eventCollectionService: EventCollectionService,
    policyService: PolicyService,
    passwordRepromptService: PasswordRepromptService,
    private broadcasterService: BroadcasterService,
    private ngZone: NgZone,
    logService: LogService,
    organizationService: OrganizationService,
    dialogService: DialogService,
    datePipe: DatePipe,
    configService: ConfigService,
    toastService: ToastService,
    cipherAuthorizationService: CipherAuthorizationService,
    sdkService: SdkService,
  ) {
    super(
      cipherService,
      folderService,
      i18nService,
      platformUtilsService,
      auditService,
      accountService,
      collectionService,
      messagingService,
      eventCollectionService,
      policyService,
      logService,
      passwordRepromptService,
      organizationService,
      dialogService,
      window,
      datePipe,
      configService,
      cipherAuthorizationService,
      toastService,
      sdkService,
    );
  }

  async ngOnInit() {
    await super.ngOnInit();
    await this.load();
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, async (message: any) => {
      this.ngZone.run(() => {
        switch (message.command) {
          case "windowHidden":
            this.onWindowHidden();
            break;
          default:
        }
      });
    });
    // We use ngOnChanges for everything else instead.
  }

  async ngOnChanges() {
    await this.load();
  }

  ngOnDestroy() {
    this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
  }

  async load() {
    if (
      document.querySelectorAll("app-vault-add-edit .ng-dirty").length === 0 ||
      (this.cipher != null && this.cipherId !== this.cipher.id)
    ) {
      this.cipher = null;
    }

    await super.load();
  }

  onWindowHidden() {
    this.showPassword = false;
    this.showCardNumber = false;
    this.showCardCode = false;
    if (this.cipher !== null && this.cipher.hasFields) {
      this.cipher.fields.forEach((field) => {
        field.showValue = false;
      });
    }
  }

  allowOwnershipOptions(): boolean {
    return (
      (!this.editMode || this.cloneMode) &&
      this.ownershipOptions &&
      (this.ownershipOptions.length > 1 || !this.allowPersonal)
    );
  }

  markPasswordAsDirty() {
    this.form.controls["Login.Password"].markAsDirty();
  }

  openHelpReprompt() {
    this.platformUtilsService.launchUri(
      "https://bitwarden.com/help/managing-items/#protect-individual-items",
    );
  }

  /**
   * Updates the cipher when an attachment is altered.
   * Note: This only updates the `attachments` and `revisionDate`
   * properties to ensure any in-progress edits are not lost.
   */
  patchCipherAttachments(cipher: CipherView) {
    this.cipher.attachments = cipher.attachments;
    this.cipher.revisionDate = cipher.revisionDate;
  }

  async importSshKeyFromClipboard(password: string = "") {
    const key = await this.platformUtilsService.readFromClipboard();
    const parsedKey = await ipc.platform.sshAgent.importKey(key, password);
    if (parsedKey == null) {
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("invalidSshKey"),
      });
      return;
    }

    switch (parsedKey.status) {
      case sshAgent.SshKeyImportStatus.ParsingError:
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: this.i18nService.t("invalidSshKey"),
        });
        return;
      case sshAgent.SshKeyImportStatus.UnsupportedKeyType:
        this.toastService.showToast({
          variant: "error",
          title: "",
          message: this.i18nService.t("sshKeyTypeUnsupported"),
        });
        return;
      case sshAgent.SshKeyImportStatus.PasswordRequired:
      case sshAgent.SshKeyImportStatus.WrongPassword:
        if (password !== "") {
          this.toastService.showToast({
            variant: "error",
            title: "",
            message: this.i18nService.t("sshKeyWrongPassword"),
          });
        } else {
          password = await this.getSshKeyPassword();
          if (password === "") {
            return;
          }
          await this.importSshKeyFromClipboard(password);
        }
        return;
      default:
        this.cipher.sshKey.privateKey = parsedKey.sshKey.privateKey;
        this.cipher.sshKey.publicKey = parsedKey.sshKey.publicKey;
        this.cipher.sshKey.keyFingerprint = parsedKey.sshKey.keyFingerprint;
        this.toastService.showToast({
          variant: "success",
          title: "",
          message: this.i18nService.t("sshKeyPasted"),
        });
    }
  }

  async getSshKeyPassword(): Promise<string> {
    const dialog = this.dialogService.open<string>(SshKeyPasswordPromptComponent, {
      ariaModal: true,
    });

    return await lastValueFrom(dialog.closed);
  }

  truncateString(value: string, length: number) {
    return value.length > length ? value.substring(0, length) + "..." : value;
  }

  togglePrivateKey() {
    this.showPrivateKey = !this.showPrivateKey;
  }
}
