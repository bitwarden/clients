// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { ChangePasswordComponent as BaseChangePasswordComponent } from "@bitwarden/angular/auth/components/change-password.component";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import { UserKeyRotationService } from "../../key-management/key-rotation/user-key-rotation.service";

@Component({
  selector: "app-change-password",
  templateUrl: "change-password.component.html",
})
export class ChangePasswordComponent
  extends BaseChangePasswordComponent
  implements OnInit, OnDestroy
{
  rotateUserKey = false;
  currentMasterPassword: string;
  masterPasswordHint: string;
  checkForBreaches = true;
  characterMinimumMessage = "";

  constructor(
    i18nService: I18nService,
    keyService: KeyService,
    messagingService: MessagingService,
    platformUtilsService: PlatformUtilsService,
    policyService: PolicyService,
    private auditService: AuditService,
    private cipherService: CipherService,
    private syncService: SyncService,
    private apiService: ApiService,
    private router: Router,
    dialogService: DialogService,
    private userVerificationService: UserVerificationService,
    private keyRotationService: UserKeyRotationService,
    kdfConfigService: KdfConfigService,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    accountService: AccountService,
    toastService: ToastService,
  ) {
    super(
      i18nService,
      keyService,
      messagingService,
      platformUtilsService,
      policyService,
      dialogService,
      kdfConfigService,
      masterPasswordService,
      accountService,
      toastService,
    );
  }

  async ngOnInit() {
    if (!(await this.userVerificationService.hasMasterPassword())) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/settings/security/two-factor"]);
    }

    await super.ngOnInit();

    this.characterMinimumMessage = this.i18nService.t("characterMinimum", this.minimumLength);
  }

  async rotateUserKeyClicked() {
    if (this.rotateUserKey) {
      const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

      const ciphers = await this.cipherService.getAllDecrypted(activeUserId);
      let hasOldAttachments = false;
      if (ciphers != null) {
        for (let i = 0; i < ciphers.length; i++) {
          if (ciphers[i].organizationId == null && ciphers[i].hasOldAttachments) {
            hasOldAttachments = true;
            break;
          }
        }
      }

      if (hasOldAttachments) {
        const learnMore = await this.dialogService.openSimpleDialog({
          title: { key: "warning" },
          content: { key: "oldAttachmentsNeedFixDesc" },
          acceptButtonText: { key: "learnMore" },
          cancelButtonText: { key: "close" },
          type: "warning",
        });

        if (learnMore) {
          this.platformUtilsService.launchUri(
            "https://bitwarden.com/help/attachments/#add-storage-space",
          );
        }
        this.rotateUserKey = false;
        return;
      }

      const result = await this.dialogService.openSimpleDialog({
        title: { key: "rotateEncKeyTitle" },
        content:
          this.i18nService.t("updateEncryptionKeyWarning") +
          " " +
          this.i18nService.t("updateEncryptionKeyExportWarning") +
          " " +
          this.i18nService.t("rotateEncKeyConfirmation"),
        type: "warning",
      });

      if (!result) {
        this.rotateUserKey = false;
      }
    }
  }

  async submit() {
    if (
      this.masterPasswordHint != null &&
      this.masterPasswordHint.toLowerCase() === this.masterPassword.toLowerCase()
    ) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("hintEqualsPassword"),
      });
      return;
    }

    this.leakedPassword = false;
    if (this.checkForBreaches) {
      this.leakedPassword = (await this.auditService.passwordLeaked(this.masterPassword)) > 0;
    }

    await super.submit();
  }

  async setupSubmitActions() {
    if (this.currentMasterPassword == null || this.currentMasterPassword === "") {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("masterPasswordRequired"),
      });
      return false;
    }

    if (this.rotateUserKey) {
      await this.syncService.fullSync(true);
    }

    return super.setupSubmitActions();
  }

  async performSubmitActions(
    newMasterPasswordHash: string,
    newMasterKey: MasterKey,
    newUserKey: [UserKey, EncString],
  ) {
    const masterKey = await this.keyService.makeMasterKey(
      this.currentMasterPassword,
      await firstValueFrom(this.accountService.activeAccount$.pipe(map((a) => a?.email))),
      await this.kdfConfigService.getKdfConfig(),
    );

    const userId = await firstValueFrom(getUserId(this.accountService.activeAccount$));
    const newLocalKeyHash = await this.keyService.hashMasterKey(
      this.masterPassword,
      newMasterKey,
      HashPurpose.LocalAuthorization,
    );

    const userKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(masterKey, userId);
    if (userKey == null) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("invalidMasterPassword"),
      });
      return;
    }

    const request = new PasswordRequest();
    request.masterPasswordHash = await this.keyService.hashMasterKey(
      this.currentMasterPassword,
      masterKey,
    );
    request.masterPasswordHint = this.masterPasswordHint;
    request.newMasterPasswordHash = newMasterPasswordHash;
    request.key = newUserKey[1].encryptedString;

    try {
      if (this.rotateUserKey) {
        this.formPromise = this.apiService.postPassword(request).then(async () => {
          // we need to save this for local masterkey verification during rotation
          await this.masterPasswordService.setMasterKeyHash(newLocalKeyHash, userId as UserId);
          await this.masterPasswordService.setMasterKey(newMasterKey, userId as UserId);
          return this.updateKey();
        });
      } else {
        this.formPromise = this.apiService.postPassword(request);
      }

      await this.formPromise;

      this.toastService.showToast({
        variant: "success",
        title: this.i18nService.t("masterPasswordChanged"),
        message: this.i18nService.t("logBackIn"),
      });
      this.messagingService.send("logout");
    } catch {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("errorOccurred"),
      });
    }
  }

  private async updateKey() {
    const user = await firstValueFrom(this.accountService.activeAccount$);
    await this.keyRotationService.rotateUserKeyAndEncryptedData(this.masterPassword, user);
  }
}
