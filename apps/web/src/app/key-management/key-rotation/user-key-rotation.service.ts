import { Injectable } from "@angular/core";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { VaultTimeoutService } from "@bitwarden/common/key-management/vault-timeout";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import { SendService } from "@bitwarden/common/tools/send/services/send.service.abstraction";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import { OrganizationUserResetPasswordService } from "../../admin-console/organizations/members/services/organization-user-reset-password/organization-user-reset-password.service";
import { WebauthnLoginAdminService } from "../../auth/core";
import { EmergencyAccessService } from "../../auth/emergency-access";

import { TestableUserKeyRotationService } from "./testable-user-key-rotation.service";
import { UserKeyRotationApiService } from "./user-key-rotation-api.service";

@Injectable()
export class UserKeyRotationService {
  private testableUserKeyRotationService: TestableUserKeyRotationService;

  constructor(
    userVerificationService: UserVerificationService,
    apiService: UserKeyRotationApiService,
    cipherService: CipherService,
    folderService: FolderService,
    sendService: SendService,
    emergencyAccessService: EmergencyAccessService,
    resetPasswordService: OrganizationUserResetPasswordService,
    deviceTrustService: DeviceTrustServiceAbstraction,
    keyService: KeyService,
    encryptService: EncryptService,
    syncService: SyncService,
    webauthnLoginAdminService: WebauthnLoginAdminService,
    logService: LogService,
    vaultTimeoutService: VaultTimeoutService,
    toastService: ToastService,
    i18nService: I18nService,
    dialogService: DialogService,
    configService: ConfigService,
    cryptoFunctionService: CryptoFunctionService,
    kdfConfigService: KdfConfigService,
    sdkClientFactory: SdkClientFactory,
  ) {
    this.testableUserKeyRotationService = new TestableUserKeyRotationService(
      userVerificationService,
      apiService,
      cipherService,
      folderService,
      sendService,
      emergencyAccessService,
      resetPasswordService,
      deviceTrustService,
      keyService,
      encryptService,
      syncService,
      webauthnLoginAdminService,
      logService,
      vaultTimeoutService,
      toastService,
      i18nService,
      dialogService,
      configService,
      cryptoFunctionService,
      kdfConfigService,
      sdkClientFactory,
    );
  }

  /**
   * Creates a new user key and re-encrypts all required data with the it.
   * @param currentMasterPassword: The current master password
   * @param newMasterPassword: The new master password
   * @param user: The user account
   * @param newMasterPasswordHint: The hint for the new master password
   */
  async rotateUserKeyMasterPasswordAndEncryptedData(
    currentMasterPassword: string,
    newMasterPassword: string,
    user: Account,
    newMasterPasswordHint?: string,
  ): Promise<void> {
    return await this.testableUserKeyRotationService.rotateUserKeyMasterPasswordAndEncryptedData(
      currentMasterPassword,
      newMasterPassword,
      user,
      newMasterPasswordHint,
    );
  }

  /**
   * Creates a new user key and re-encrypts all required data with the it.
   * @param masterPassword current master password (used for validation)
   * @deprecated
   */
  async rotateUserKeyAndEncryptedDataLegacy(masterPassword: string, user: Account): Promise<void> {
    return await this.testableUserKeyRotationService.rotateUserKeyAndEncryptedDataLegacy(
      masterPassword,
      user,
    );
  }
}
