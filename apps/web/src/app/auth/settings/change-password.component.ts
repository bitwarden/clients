// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { ChangePasswordComponent as BaseChangePasswordComponent } from "@bitwarden/angular/auth/components/change-password.component";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import { UserKeyRotationService } from "../../key-management/key-rotation/user-key-rotation.service";

/**
 * @deprecated use the auth `PasswordSettingsComponent` instead
 */
@Component({
  selector: "app-change-password",
  templateUrl: "change-password.component.html",
  standalone: false,
})
export class ChangePasswordComponent
  extends BaseChangePasswordComponent
  implements OnInit, OnDestroy
{
  loading = false;
  rotateUserKey = false;
  currentMasterPassword: string;
  masterPasswordHint: string;
  checkForBreaches = true;
  characterMinimumMessage = "";

  constructor(
    private auditService: AuditService,
    private cipherService: CipherService,
    private keyRotationService: UserKeyRotationService,
    private masterPasswordApiService: MasterPasswordApiService,
    private router: Router,
    private syncService: SyncService,
    private userVerificationService: UserVerificationService,
    protected accountService: AccountService,
    protected dialogService: DialogService,
    protected i18nService: I18nService,
    protected kdfConfigService: KdfConfigService,
    protected keyService: KeyService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected messagingService: MessagingService,
    protected platformUtilsService: PlatformUtilsService,
    protected policyService: PolicyService,
    protected toastService: ToastService,
  ) {
    super(
      accountService,
      dialogService,
      i18nService,
      kdfConfigService,
      keyService,
      masterPasswordService,
      messagingService,
      platformUtilsService,
      policyService,
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
          this.i18nService.t("updateEncryptionKeyAccountExportWarning") +
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
    this.loading = true;
    if (this.currentMasterPassword == null || this.currentMasterPassword === "") {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("masterPasswordRequired"),
      });
      this.loading = false;
      return;
    }

    if (
      this.masterPasswordHint != null &&
      this.masterPasswordHint.toLowerCase() === this.masterPassword.toLowerCase()
    ) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("hintEqualsPassword"),
      });
      this.loading = false;
      return;
    }

    this.leakedPassword = false;
    if (this.checkForBreaches) {
      this.leakedPassword = (await this.auditService.passwordLeaked(this.masterPassword)) > 0;
    }

    if (!(await this.strongPassword())) {
      this.loading = false;
      return;
    }

    try {
      if (this.rotateUserKey) {
        await this.syncService.fullSync(true);
        const user = await firstValueFrom(this.accountService.activeAccount$);
        await this.keyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
          this.currentMasterPassword,
          this.masterPassword,
          user,
          this.masterPasswordHint,
        );
      } else {
        await this.updatePassword(this.masterPassword);
      }
    } catch (e) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: e.message,
      });
    } finally {
      this.loading = false;
    }
  }

  // todo: move this to a service
  // https://bitwarden.atlassian.net/browse/PM-17108
  private async updatePassword(newMasterPassword: string) {
    const currentMasterPassword = this.currentMasterPassword;
    const { userId, email } = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => ({ userId: a?.id, email: a?.email }))),
    );
    const kdfConfig = await firstValueFrom(this.kdfConfigService.getKdfConfig$(userId));

    const currentMasterKey = await this.keyService.makeMasterKey(
      currentMasterPassword,
      email,
      kdfConfig,
    );
    const decryptedUserKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(
      currentMasterKey,
      userId,
    );
    if (decryptedUserKey == null) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("invalidMasterPassword"),
      });
      return;
    }

    const newMasterKey = await this.keyService.makeMasterKey(newMasterPassword, email, kdfConfig);
    const newMasterKeyEncryptedUserKey = await this.keyService.encryptUserKeyWithMasterKey(
      newMasterKey,
      decryptedUserKey,
    );

    const request = new PasswordRequest();
    request.masterPasswordHash = await this.keyService.hashMasterKey(
      this.currentMasterPassword,
      currentMasterKey,
    );
    request.masterPasswordHint = this.masterPasswordHint;
    request.newMasterPasswordHash = await this.keyService.hashMasterKey(
      newMasterPassword,
      newMasterKey,
    );
    request.key = newMasterKeyEncryptedUserKey[1].encryptedString;
    try {
      await this.masterPasswordApiService.postPassword(request);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("masterPasswordChanged"),
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
}
