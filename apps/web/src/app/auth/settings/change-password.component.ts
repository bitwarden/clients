import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, Observable } from "rxjs";

import { ChangePasswordComponent as BaseChangePasswordComponent } from "@bitwarden/angular/auth/components/change-password.component";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationUserService } from "@bitwarden/common/admin-console/abstractions/organization-user/organization-user.service";
import { OrganizationUserResetPasswordEnrollmentRequest } from "@bitwarden/common/admin-console/abstractions/organization-user/requests";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UpdateKeyRequest } from "@bitwarden/common/models/request/update-key.request";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { MasterKey, UserKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";
import { SendWithIdRequest } from "@bitwarden/common/tools/send/models/request/send-with-id.request";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { CipherWithIdRequest } from "@bitwarden/common/vault/models/request/cipher-with-id.request";
import { FolderWithIdRequest } from "@bitwarden/common/vault/models/request/folder-with-id.request";
import { DialogService } from "@bitwarden/components";

import { EmergencyAccessService } from "../emergency-access";

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

  protected showWebauthnLoginSettings$: Observable<boolean>;

  constructor(
    i18nService: I18nService,
    cryptoService: CryptoService,
    messagingService: MessagingService,
    stateService: StateService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
    platformUtilsService: PlatformUtilsService,
    policyService: PolicyService,
    private auditService: AuditService,
    private folderService: FolderService,
    private cipherService: CipherService,
    private syncService: SyncService,
    private emergencyAccessService: EmergencyAccessService,
    private apiService: ApiService,
    private sendService: SendService,
    private organizationService: OrganizationService,
    private router: Router,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private organizationUserService: OrganizationUserService,
    dialogService: DialogService,
    private userVerificationService: UserVerificationService,
    private deviceTrustCryptoService: DeviceTrustCryptoServiceAbstraction,
    private configService: ConfigServiceAbstraction,
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
    this.showWebauthnLoginSettings$ = this.configService.getFeatureFlag$(
      FeatureFlag.PasswordlessLogin,
    );

    if (!(await this.userVerificationService.hasMasterPassword())) {
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
      await this.syncService.fullSync(true, "rotate-user-key");
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
          return this.updateKey(newMasterKey, request.newMasterPasswordHash);
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

  private async updateKey(masterKey: MasterKey, masterPasswordHash: string) {
    const [newUserKey, masterKeyEncUserKey] = await this.cryptoService.makeUserKey(masterKey);
    const userPrivateKey = await this.cryptoService.getPrivateKey();
    let encPrivateKey: EncString = null;
    if (userPrivateKey != null) {
      encPrivateKey = await this.cryptoService.encrypt(userPrivateKey, newUserKey);
    }
    const request = new UpdateKeyRequest();
    request.privateKey = encPrivateKey != null ? encPrivateKey.encryptedString : null;
    request.key = masterKeyEncUserKey.encryptedString;
    request.masterPasswordHash = masterPasswordHash;

    const folders = await firstValueFrom(this.folderService.folderViews$);
    for (let i = 0; i < folders.length; i++) {
      if (folders[i].id == null) {
        continue;
      }
      const folder = await this.folderService.encrypt(folders[i], newUserKey);
      request.folders.push(new FolderWithIdRequest(folder));
    }

    const ciphers = await this.cipherService.getAllDecrypted();
    for (let i = 0; i < ciphers.length; i++) {
      if (ciphers[i].organizationId != null) {
        continue;
      }

      const cipher = await this.cipherService.encrypt(ciphers[i], newUserKey);
      request.ciphers.push(new CipherWithIdRequest(cipher));
    }

    const sends = await firstValueFrom(this.sendService.sends$);
    await Promise.all(
      sends.map(async (send) => {
        const sendKey = await this.cryptoService.decryptToBytes(send.key, null);
        send.key = (await this.cryptoService.encrypt(sendKey, newUserKey)) ?? send.key;
        request.sends.push(new SendWithIdRequest(send));
      }),
    );

    await this.deviceTrustCryptoService.rotateDevicesTrust(newUserKey, masterPasswordHash);

    await this.apiService.postAccountKey(request);

    await this.emergencyAccessService.rotate(newUserKey);

    await this.updateAllResetPasswordKeys(newUserKey, masterPasswordHash);
  }

  private async updateAllResetPasswordKeys(userKey: UserKey, masterPasswordHash: string) {
    const orgs = await this.organizationService.getAll();

    for (const org of orgs) {
      // If not already enrolled, skip
      if (!org.resetPasswordEnrolled) {
        continue;
      }

      // Retrieve public key
      const response = await this.organizationApiService.getKeys(org.id);
      const publicKey = Utils.fromB64ToArray(response?.publicKey);

      // Re-enroll - encrypt user's encKey.key with organization public key
      const encryptedKey = await this.cryptoService.rsaEncrypt(userKey.key, publicKey);

      // Create/Execute request
      const request = new OrganizationUserResetPasswordEnrollmentRequest();
      request.masterPasswordHash = masterPasswordHash;
      request.resetPasswordKey = encryptedKey.encryptedString;

      await this.organizationUserService.putOrganizationUserResetPasswordEnrollment(
        org.id,
        org.userId,
        request,
      );
    }
  }
}
