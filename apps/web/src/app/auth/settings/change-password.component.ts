import { Component } from "@angular/core";
import { Router } from "@angular/router";

import { ChangePasswordComponent as BaseChangePasswordComponent } from "@bitwarden/angular/auth/components/change-password.component";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";

import { UserKeyRotationService } from "../key-rotation/user-key-rotation.service";

@Component({
  selector: "app-change-password",
  templateUrl: "change-password.component.html",
})
export class ChangePasswordComponent extends BaseChangePasswordComponent {
  rotateUserKey = false;
  currentMasterPassword: string;
  masterPasswordHint: string;
  checkForBreaches = true;
  characterMinimumMessage = "";

  constructor(
    i18nService: I18nService,
    cryptoService: CryptoService,
    messagingService: MessagingService,
    stateService: StateService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
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
  ) {
    super(
      i18nService,
      cryptoService,
      messagingService,
      passwordGenerationService,
      platformUtilsService,
      policyService,
      stateService,
      dialogService,
    );
  }

  async ngOnInit() {
    if (!(await this.userVerificationService.hasMasterPassword())) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate(["/settings/security/two-factor"]);
    }

    this.masterPasswordHint = (await this.apiService.getProfile()).masterPasswordHint;
    await super.ngOnInit();

    this.characterMinimumMessage = this.i18nService.t("characterMinimum", this.minimumLength);
  }

  async rotateUserKeyClicked() {
    if (this.rotateUserKey) {
      const ciphers = await this.cipherService.getAllDecrypted();
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
    if (this.masterPasswordHint != null && this.masterPasswordHint == this.masterPassword) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("hintEqualsPassword"),
      );
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
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("masterPasswordRequired"),
      );
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
    const masterKey = await this.cryptoService.getOrDeriveMasterKey(this.currentMasterPassword);
    const request = new PasswordRequest();
    request.masterPasswordHash = await this.cryptoService.hashMasterKey(
      this.currentMasterPassword,
      masterKey,
    );
    request.masterPasswordHint = this.masterPasswordHint;
    request.newMasterPasswordHash = newMasterPasswordHash;
    request.key = newUserKey[1].encryptedString;

    try {
      if (this.rotateUserKey) {
        this.formPromise = this.apiService.postPassword(request).then(() => {
          return this.updateKey();
        });
      } else {
        this.formPromise = this.apiService.postPassword(request);
      }

      await this.formPromise;

      this.platformUtilsService.showToast(
        "success",
        this.i18nService.t("masterPasswordChanged"),
        this.i18nService.t("logBackIn"),
      );
      this.messagingService.send("logout");
    } catch {
      this.platformUtilsService.showToast("error", null, this.i18nService.t("errorOccurred"));
    }
  }

  private async updateKey() {
    await this.keyRotationService.rotateUserKeyAndEncryptedData(this.masterPassword);
  }
}
